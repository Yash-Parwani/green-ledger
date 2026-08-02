import Link from "next/link";
import { LedgerTape } from "@/components/ui/LedgerTape";
import { LiveDemoChat } from "@/components/console/LiveDemoChat";

// These describe what the system does, not how much it has done. GreenLedger
// has no deployments yet, so there are no volume figures to quote — this page
// previously showed "₹6.4 Cr deployed" and "1,240 societies & corporates",
// which is a traction claim rather than a product claim. Don't reintroduce
// usage metrics here until they're real and pulled from the ledger.
const HERO_STATS = [
  { value: "3", label: "SWIGGY SURFACES — FOOD, INSTAMART, DINEOUT", color: "#0C744B" },
  { value: "0", label: "RUPEES COMMITTABLE WITHOUT A HUMAN APPROVAL", color: "#A24405" },
  { value: "100%", label: "OF SPEND DECISIONS WRITTEN TO AN APPEND-ONLY LEDGER", color: "#17140F" },
];

// The three sourcing routes a CSR budget can take through the product. Shares
// are the shape of a typical program, labelled as such — not reported spend.
const PROGRAM_BARS = [
  { name: "Instamart bulk staples", pct: 62, detail: "for NGOs that cook on-site" },
  { name: "Food partner kitchens", pct: 28, detail: "cooked meals from partner kitchens" },
  { name: "Dineout community tables", pct: 10, detail: "festival and community meals" },
];

const LEDGER_ROWS = [
  { label: "Every commitment", value: "approved by a person, on the record" },
  { label: "Every donee", value: "80G/12A verified before spend" },
  { label: "Every rupee", value: "80G receipt + GST invoice, as PDFs" },
];

export default function LandingPage() {
  return (
    <div
      className="relative"
      style={{
        backgroundImage:
          "repeating-linear-gradient(180deg, rgba(217,203,168,.34) 0 1px, transparent 1px 34px), radial-gradient(900px 520px at 88% -8%, rgba(18,145,94,.16), transparent 62%), radial-gradient(760px 460px at 4% 2%, rgba(232,107,16,.18), transparent 60%)",
      }}
    >
      <section className="mx-auto grid max-w-[1240px] grid-cols-[repeat(auto-fit,minmax(340px,1fr))] items-center gap-11 px-6 pt-14 pb-[34px] sm:px-8">
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-full border border-paper-line bg-white py-1.5 pl-2.5 pr-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-600">
            <span
              aria-hidden
              className="inline-block h-[9px] w-[9px] rounded-full"
              style={{ background: "linear-gradient(115deg, #E86B10 0 50%, #12915E 50% 100%)" }}
            />
            Built on Swiggy · pooled &amp; sponsored spend only
          </div>

          <h1
            className="mt-[22px] font-display text-[clamp(40px,5.6vw,72px)] font-semibold leading-[1.0] tracking-[-0.03em] text-ink-900"
            style={{ maxWidth: "18ch", textWrap: "pretty" }}
          >
            Deploy the budget.
            <br />
            <span
              className="italic"
              style={{
                backgroundImage: "linear-gradient(100deg, #E86B10, #12915E)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Not the spreadsheet.
            </span>
          </h1>

          <p className="mt-[22px] max-w-[50ch] text-[17.5px] leading-[1.6] text-ink-600" style={{ textWrap: "pretty" }}>
            One console for corporate CSR spend — scheduled programs, stacked
            coupons, 80G and GST paperwork generated automatically. The same
            engine also plans community events; it&rsquo;s one tap away, not a
            separate product.
          </p>

          <div className="mt-[30px] flex flex-wrap gap-3">
            <Link
              href="/console?mode=csr"
              className="rounded-lg bg-green-500 px-[22px] py-[14px] text-[15px] font-semibold text-white shadow-[0_10px_22px_-10px_rgba(18,145,94,.9)] transition-all hover:-translate-y-0.5 hover:bg-green-600 hover:shadow-[0_16px_28px_-12px_rgba(18,145,94,.95)]"
            >
              Open the CSR console →
            </Link>
            <Link
              href="/console?mode=community"
              className="rounded-lg border border-orange-500 bg-white px-[22px] py-[14px] text-[15px] font-semibold text-orange-600 transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_26px_-14px_rgba(232,107,16,.9)]"
            >
              Plan a community event →
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-[22px] border-t border-dashed border-paper-rule pt-5">
            {HERO_STATS.map((s) => (
              <div key={s.label}>
                <div className="font-mono text-[21px] font-semibold" style={{ color: s.color }}>
                  {s.value}
                </div>
                <div className="mt-[3px] font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-500">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <LiveDemoChat />
      </section>

      <div className="mt-[34px]">
        <LedgerTape />
      </div>

      <section className="mx-auto grid max-w-[1160px] grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-[38px] px-6 pt-[70px] pb-2.5 sm:px-8">
        <ProductCard
          eyebrow="Product 01 · CSR teams, foundations, NGOs"
          eyebrowColor="#0C744B"
          name="Second Helping"
          body="A Slack-native agent that turns an approved CSR budget into recurring meal programs with partner NGOs — schedules them, tracks the spend, and files the 80G receipts and GST invoices before anyone asks."
          bullets={[
            "Recurring sponsorships approved in-thread",
            "Auto-generated 80G receipts + GST invoices",
            "Every rupee traceable to a meal, an NGO, a date",
          ]}
          bulletColor="#12915E"
          rotate={-1.1}
          href="/console?mode=csr"
          cta="Open the console →"
          ctaColor="#0C744B"
          number="no. 001"
        />
        <ProductCard
          eyebrow="Product 02 · societies, offices, committees"
          eyebrowColor="#A24405"
          name="The Group Concierge"
          body="One chat plans the whole thing: catering from Swiggy Food, cups and décor from Instamart, a private room via Dineout. Collect from 60 households, pay once, hand the treasurer a line-item ledger."
          bullets={[
            "Pooled collection with per-household split",
            "Venue, catering and supplies as one confirmable plan",
            "GST invoice in the organisation's name",
          ]}
          bulletColor="#E86B10"
          rotate={1.3}
          href="/console?mode=community"
          cta="Open the concierge →"
          ctaColor="#A24405"
          number="no. 002"
        />
      </section>

      <section className="mx-auto max-w-[1160px] px-6 pt-[74px] sm:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-5">
          <h2 className="font-display text-[clamp(26px,3.4vw,38px)] font-semibold tracking-[-0.022em] text-ink-900">
            Where a CSR budget actually goes.
          </h2>
          <span className="font-mono text-[11px] uppercase tracking-[0.09em] text-ink-500">
            typical program shape · not reported spend
          </span>
        </div>
        <div className="mt-6 flex flex-col">
          {PROGRAM_BARS.map((p) => (
            <div key={p.name} className="border-b border-dashed border-paper-rule py-4">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[15px] font-semibold text-ink-900">{p.name}</span>
                <span className="font-mono text-[13.5px] text-ink-600">{p.pct}%</span>
              </div>
              <div className="mt-2.5 h-[9px] overflow-hidden rounded-full bg-paper-dim">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-orange-500 to-green-500 transition-[width] duration-[900ms]"
                  style={{ width: `${p.pct}%` }}
                />
              </div>
              <div className="mt-[7px] font-mono text-[11px] text-ink-500">{p.detail}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1160px] px-6 pt-[78px] sm:px-8">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] items-start gap-[34px] rounded border border-paper-lineDim bg-paper-dim px-10 py-11">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.11em] text-ink-500">
              Same ledger, two kinds of Saturday
            </div>
            <p
              className="mt-4 font-display text-[27px] font-normal italic leading-[1.28] tracking-[-0.015em] text-ink-900"
              style={{ textWrap: "pretty" }}
            >
              This quarter, a company deployed ₹85,000 of CSR budget instead of
              letting it lapse. The same ledger booked a society&rsquo;s Diwali
              potluck for sixty households — same system, one switch.
            </p>
          </div>
          <div className="flex flex-col">
            {LEDGER_ROWS.map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-4 border-b border-dashed border-paper-rule py-[13px]"
              >
                <span className="text-[14.5px] text-ink-600">{row.label}</span>
                <span className="whitespace-nowrap font-mono text-sm font-medium text-ink-900">{row.value}</span>
              </div>
            ))}
            <div className="mt-[18px] h-2 rounded-full bg-gradient-to-r from-orange-500 to-green-500" />
            <div className="mt-2.5 font-mono text-[11px] text-ink-500">
              green = sponsored CSR spend · orange = pooled community spend
            </div>
          </div>
        </div>
      </section>

      <section className="mt-16 flex justify-center pb-16">
        <a
          href="https://github.com/Yash-Parwani/green-ledger"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-ink-300 px-4 py-2 text-xs font-medium text-ink-600 transition-colors hover:border-ink-400 hover:text-ink-900"
        >
          View source on GitHub
        </a>
      </section>
    </div>
  );
}

function ProductCard({
  eyebrow,
  eyebrowColor,
  name,
  body,
  bullets,
  bulletColor,
  rotate,
  href,
  cta,
  ctaColor,
  number,
}: {
  eyebrow: string;
  eyebrowColor: string;
  name: string;
  body: string;
  bullets: string[];
  bulletColor: string;
  rotate: number;
  href: string;
  cta: string;
  ctaColor: string;
  number: string;
}) {
  return (
    <article
      className="group relative rounded border border-paper-line bg-white pb-[30px] shadow-[0_14px_34px_-20px_rgba(23,20,15,0.35)] transition-all duration-[350ms] hover:rotate-0 hover:shadow-[0_20px_44px_-20px_rgba(23,20,15,0.4)]"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <div
        aria-hidden
        className="h-4"
        style={{
          backgroundImage: "radial-gradient(circle at 9px 8px, #F6F0E2 0 5.5px, transparent 6px)",
          backgroundSize: "18px 16px",
          backgroundRepeat: "repeat-x",
        }}
      />
      <div className="px-[30px] pt-[22px]">
        <div className="font-mono text-[11px] uppercase tracking-[0.11em]" style={{ color: eyebrowColor }}>
          {eyebrow}
        </div>
        <h2 className="mt-3 font-display text-[32px] font-semibold leading-[1.08] tracking-[-0.02em] text-ink-900">
          {name}
        </h2>
        <p className="mt-3.5 text-[15.5px] leading-[1.62] text-ink-600">{body}</p>
        <ul className="mt-5 flex flex-col gap-2.5">
          {bullets.map((b) => (
            <li key={b} className="flex gap-2.5 text-[14.5px] text-ink-600">
              <span className="font-bold" style={{ color: bulletColor }}>
                —
              </span>
              {b}
            </li>
          ))}
        </ul>
      </div>
      <div className="mx-[30px] mt-[26px] flex items-center justify-between gap-3 border-t border-dashed border-paper-rule pt-[18px]">
        <Link href={href} className="text-[15px] font-semibold hover:underline" style={{ color: ctaColor }}>
          {cta}
        </Link>
        <span className="font-mono text-[11px] text-ink-500">{number}</span>
      </div>
    </article>
  );
}
