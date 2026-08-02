import Link from "next/link";

const LINKS = [
  { href: "/console", label: "Open GreenLedger" },
  { href: "/second-helping/impact", label: "Impact Ledger" },
];

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-paper-rule bg-paper/90 backdrop-blur">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-6xl items-center justify-between gap-5 px-6 py-3.5 sm:px-8"
      >
        <Link href="/" className="flex items-center gap-2.5 font-display text-[21px] font-bold tracking-tight text-ink-900">
          <span
            aria-hidden
            className="inline-block h-[11px] w-[11px] rounded-full"
            style={{ background: "linear-gradient(115deg, #E86B10 0 50%, #12915E 50% 100%)" }}
          />
          GreenLedger
        </Link>
        <ul className="flex items-center gap-6 text-sm font-medium text-ink-600">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="transition-colors hover:text-ink-900">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
