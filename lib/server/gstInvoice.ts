// GST tax invoice generation, shared by Second Helping and The Group Concierge.
//
// Both products issue the same document for the same reason — a vendor purchase
// that a finance team has to file — so the arithmetic and the PDF live in one
// place. They previously had separate near-identical copies, which is how the
// two drift: a rounding fix or a CGST/SGST correction lands in one and not the
// other, and only one product's invoices are right.

import { artifacts } from "@/lib/server/artifacts";
import { renderDocument, formatInr } from "@/lib/server/pdf";
import type { AgentContext } from "@/lib/server/session";

export type GstInvoiceInput = {
  buyer_name: string;
  buyer_gstin?: string;
  vendor_name: string;
  vendor_gstin: string;
  place_of_supply: string;
  items: { description: string; hsn_or_sac: string; quantity: number; unit_price_inr: number }[];
  gst_rate_pct?: number;
};

const DEFAULT_GST_RATE_PCT = 5; // standard rate for food/catering/venue services

export async function buildGstInvoice(ctx: AgentContext, input: GstInvoiceInput) {
  const taxableValue = input.items.reduce((sum, i) => sum + i.quantity * i.unit_price_inr, 0);
  const rate = input.gst_rate_pct ?? DEFAULT_GST_RATE_PCT;
  const totalTax = Math.round(taxableValue * (rate / 100));

  // Split intrastate tax as CGST + SGST. SGST takes the remainder so the two
  // halves always reconcile to totalTax on odd amounts rather than losing a
  // rupee to double rounding.
  const cgst = Math.round(totalTax / 2);
  const sgst = totalTax - cgst;

  const invoiceId = `GST-${Date.now()}`;
  const invoiceNumber = `INV/${new Date().getFullYear()}/${invoiceId.slice(-6)}`;
  const buyerGstin = input.buyer_gstin ?? "URP (unregistered)";
  const issuedAt = new Date();

  const pdf = renderDocument({
    eyebrow: "Issued via GreenLedger",
    title: "Tax Invoice",
    subtitle: `${invoiceNumber} | ${issuedAt.toLocaleDateString("en-IN")}`,
    sections: [
      {
        heading: "Supplier",
        rows: [
          { label: "Name", value: input.vendor_name },
          { label: "GSTIN", value: input.vendor_gstin },
        ],
      },
      {
        heading: "Recipient",
        rows: [
          { label: "Name", value: input.buyer_name },
          { label: "GSTIN", value: buyerGstin },
          { label: "Place of supply", value: input.place_of_supply },
        ],
      },
      {
        heading: "Supply",
        rows: input.items.map((i) => ({
          label: `${i.description} (HSN/SAC ${i.hsn_or_sac}) x ${i.quantity}`,
          value: formatInr(i.quantity * i.unit_price_inr),
        })),
      },
      {
        heading: "Tax",
        rows: [
          { label: "Taxable value", value: formatInr(taxableValue) },
          { label: `CGST @ ${rate / 2}%`, value: formatInr(cgst) },
          { label: `SGST @ ${rate / 2}%`, value: formatInr(sgst) },
          { label: "IGST", value: formatInr(0) },
          { label: "Total payable", value: formatInr(taxableValue + totalTax) },
        ],
      },
    ],
    footnotes: [
      "Intrastate supply: tax split as CGST and SGST. For interstate supply this would be issued as IGST at the full rate.",
      "Generated from the vendor and line-item details recorded against this purchase. Verify the supplier GSTIN against the vendor's own invoice before filing.",
    ],
  });

  const artifact = await artifacts.put({
    orgId: ctx.orgId,
    kind: "gst_invoice",
    filename: `gst-invoice-${invoiceId}.pdf`,
    bytes: pdf,
  });

  return {
    invoice_id: invoiceId,
    invoice_number: invoiceNumber,
    vendor_name: input.vendor_name,
    vendor_gstin: input.vendor_gstin,
    buyer_name: input.buyer_name,
    buyer_gstin: buyerGstin,
    place_of_supply: input.place_of_supply,
    taxable_value_inr: taxableValue,
    gst_rate_pct: rate,
    cgst_inr: cgst,
    sgst_inr: sgst,
    igst_inr: 0,
    total_tax_inr: totalTax,
    grand_total_inr: taxableValue + totalTax,
    pdf_url: `/api/documents/${artifact.id}`,
    issued_at: issuedAt.toISOString(),
  };
}
