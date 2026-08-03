// A minimal PDF writer, enough for the one document shape this product
// produces: a titled statement with a label/value table and footnotes.
//
// Hand-rolled rather than pulling in a PDF library because the requirement is
// narrow (single page, two built-in fonts, no images or wrapping tables) and a
// dependency here would be a large surface for a small need. If documents grow
// to multi-page invoices with logos, swap this for pdfkit — the callers only
// use renderDocument(), so the blast radius is this file.
//
// Text is encoded as WinAnsi, which has no rupee sign. Callers must pass
// "INR 4,00,000" rather than "₹4,00,000" — formatInr() below does that. A "₹"
// that slipped through would render as a wrong glyph on a document a CFO reads,
// so non-encodable characters are stripped rather than silently mangled.

const PAGE_WIDTH = 595; // A4 at 72dpi
const PAGE_HEIGHT = 842;
const MARGIN = 56;
/** Width reserved for the label column before the value column starts. */
const LABEL_COLUMN_WIDTH = 210;
/** Helvetica averages a shade under half the point size per character, so this
 *  is how many characters fit in the label column at 10pt before they'd run
 *  under the value. Kept slightly conservative. */
const LABEL_MAX_CHARS = 38;

export type DocumentSpec = {
  title: string;
  subtitle?: string;
  /** Small text above the title, e.g. the issuer. */
  eyebrow?: string;
  sections: { heading?: string; rows: { label: string; value: string }[] }[];
  /** Rendered small at the bottom — legal notes, disclaimers. */
  footnotes?: string[];
};

/** Format money for a PDF: no rupee glyph in WinAnsi, so spell the currency. */
export function formatInr(amount: number): string {
  return `INR ${Math.round(amount).toLocaleString("en-IN")}`;
}

/** Escape for a PDF literal string and drop anything WinAnsi can't represent. */
function pdfText(s: string): string {
  return s
    .replace(/₹/g, "INR ")
    .replace(/[—–]/g, "-")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

/** Naive width estimate for Helvetica; good enough to wrap footnote prose. */
function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (line && (line + " " + w).length > maxChars) {
      lines.push(line);
      line = w;
    } else {
      line = line ? `${line} ${w}` : w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function buildContentStream(spec: DocumentSpec): string {
  const ops: string[] = [];
  let y = PAGE_HEIGHT - MARGIN;

  const write = (text: string, font: "F1" | "F2", size: number, x = MARGIN) => {
    ops.push(`BT /${font} ${size} Tf ${x} ${y} Td (${pdfText(text)}) Tj ET`);
  };
  const rule = () => {
    ops.push(`0.8 G ${MARGIN} ${y} m ${PAGE_WIDTH - MARGIN} ${y} l S`);
  };

  if (spec.eyebrow) {
    write(spec.eyebrow.toUpperCase(), "F2", 8);
    y -= 20;
  }

  write(spec.title, "F1", 18);
  y -= 20;

  if (spec.subtitle) {
    write(spec.subtitle, "F2", 10);
    y -= 16;
  }

  y -= 8;
  rule();
  y -= 24;

  for (const section of spec.sections) {
    if (section.heading) {
      write(section.heading.toUpperCase(), "F1", 9);
      y -= 18;
    }
    for (const row of section.rows) {
      // Labels wrap inside the left column instead of running under the value.
      //
      // They used to be written as a single line at x=MARGIN with the value at
      // a fixed x=MARGIN+210, on the assumption that labels were short. A GST
      // supply line isn't: "Veg Thali (pure veg) - cooked meal, Sneha Shelters
      // (HSN/SAC 996331) x 100" ran straight through the amount and rendered
      // as "Sneha She INR 31,900 lters". Overlapping text on a tax invoice is
      // the kind of detail that costs you the room.
      const labelLines = wrap(row.label, LABEL_MAX_CHARS);
      write(labelLines[0] ?? "", "F2", 10);
      write(row.value, "F1", 10, MARGIN + LABEL_COLUMN_WIDTH);
      y -= 17;
      for (const cont of labelLines.slice(1)) {
        write(cont, "F2", 10);
        y -= 13;
      }
    }
    y -= 12;
  }

  if (spec.footnotes?.length) {
    y -= 4;
    rule();
    y -= 18;
    for (const note of spec.footnotes) {
      for (const line of wrap(note, 96)) {
        write(line, "F2", 8);
        y -= 11;
      }
      y -= 6;
    }
  }

  return ops.join("\n");
}

export function renderDocument(spec: DocumentSpec): Buffer {
  const content = buildContentStream(spec);
  const contentBytes = Buffer.byteLength(content, "latin1");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${contentBytes} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];

  // Assemble while tracking byte offsets — the xref table is offset-based, so
  // it has to be built from the real serialized length, not an estimate.
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}
