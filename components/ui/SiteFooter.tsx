export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-dashed border-paper-rule">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-6 py-8 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="inline-block h-[9px] w-[9px] rounded-full"
            style={{ background: "linear-gradient(115deg, #E86B10 0 50%, #12915E 50% 100%)" }}
          />
          <span className="font-mono text-[11.5px] text-ink-500">
            GreenLedger · Swiggy Builders Club submission
          </span>
        </div>
        <p className="font-mono text-[11.5px] text-ink-500">
          One console, one switch: corporate CSR by default, community events one tap away.
        </p>
      </div>
    </footer>
  );
}
