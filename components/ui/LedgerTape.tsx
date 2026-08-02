// What each ledger entry records — not named customers. These previously read
// as real activity from named companies ("Radiance Corp · ₹85,000 deployed"),
// which is a fabricated customer list on a page pitching an auditable ledger.
const ENTRIES = [
  "commitment · amount, donee, cadence, and the tool call that created it",
  "policy refusal · what was blocked, which rule, and why",
  "approval · who signed off, bound to the exact figures approved",
  "donee verified · 80G/12A registration, checked by a human, timestamped",
  "document · 80G receipt and GST invoice, stored and retrievable",
  "correction · appended, never overwriting what it supersedes",
];

export function LedgerTape() {
  const doubled = [...ENTRIES, ...ENTRIES];
  return (
    <div
      aria-label="What the ledger records"
      className="overflow-hidden bg-ink-950"
      style={{
        maskImage: "linear-gradient(90deg, transparent 0, #000 7%, #000 93%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(90deg, transparent 0, #000 7%, #000 93%, transparent 100%)",
      }}
    >
      {/* Screen readers get the list once, statically — the marquee is decorative motion. */}
      <span className="sr-only">The ledger records: {ENTRIES.join(". ")}</span>
      <div aria-hidden className="flex h-[46px] w-max animate-marquee items-center whitespace-nowrap">
        {doubled.map((entry, i) => (
          <span
            key={i}
            className="flex items-center gap-2.5 border-r border-dashed border-ink-700 px-6 font-mono text-[12.5px] text-[#E3DACA]"
          >
            <span className="font-semibold text-mint">✓</span>
            {entry}
          </span>
        ))}
      </div>
    </div>
  );
}
