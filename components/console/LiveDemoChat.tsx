"use client";

import { useRef, useState } from "react";
import Link from "next/link";

type LedgerRow = { k: string; v: string };

type DemoChip = {
  label: string;
  brief: string;
  mode: "csr" | "community";
  title: string;
  rows: LedgerRow[];
  cta: string;
};

const CHIPS: DemoChip[] = [
  {
    label: "CSR meal program · ₹12L",
    brief: "We have ₹12L in CSR budget left this quarter — set up a recurring meal program.",
    mode: "csr",
    title: "Draft program",
    rows: [
      { k: "Utilization", v: "38% · 96 days left" },
      { k: "Proposed split", v: "70% Instamart · 30% Food" },
      { k: "Paperwork", v: "80G + GST, automatic" },
    ],
    cta: "Open the full console →",
  },
  {
    label: "RWA Diwali potluck · 60 households",
    brief: "60 households, Diwali potluck, ₹85,000 pooled budget, this Saturday.",
    mode: "community",
    title: "Draft plan",
    rows: [
      { k: "Venue", v: "₹1,500/head" },
      { k: "Décor + drinks", v: "Instamart, same drop" },
      { k: "Pooled bill", v: "₹85,000 ÷ 60 households" },
    ],
    cta: "Open the full console →",
  },
  {
    label: "Company offsite lunch · 140 staff",
    brief: "Team offsite lunch for 140 staff in Bandra next Friday, ₹1.2L company budget.",
    mode: "community",
    title: "Draft plan",
    rows: [
      { k: "Catering", v: "140 covers, noon delivery" },
      { k: "Total", v: "₹1,20,000" },
      { k: "Paperwork", v: "GST invoice to finance" },
    ],
    cta: "Open the full console →",
  },
];

export function LiveDemoChat() {
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [active, setActive] = useState<DemoChip | null>(null);
  const [revealed, setRevealed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function playDemo(chip: DemoChip) {
    if (timerRef.current) clearInterval(timerRef.current);
    setActive(chip);
    setRevealed(false);
    setInput("");
    setTyping(true);
    let i = 0;
    timerRef.current = setInterval(() => {
      i += 1;
      setInput(chip.brief.slice(0, i));
      if (i >= chip.brief.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        setTyping(false);
        setTimeout(() => setRevealed(true), 450);
      }
    }, 16);
  }

  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute inset-[14px_-10px_-14px_12px] rounded-lg border border-paper-lineDim bg-paper-dim"
        style={{ transform: "rotate(2deg)" }}
      />
      <section
        aria-label="Try the concierge"
        className="relative overflow-hidden rounded-lg border border-paper-line bg-white shadow-[0_26px_60px_-34px_rgba(23,20,15,0.55)]"
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
        <div className="flex items-center justify-between gap-3 border-b border-dashed border-paper-rule px-[18px] py-3">
          <span className="flex items-center gap-2.5 text-[13.5px] font-semibold text-ink-900">
            <span
              aria-hidden
              className="inline-block h-[9px] w-[9px] rounded-full"
              style={{ background: "linear-gradient(115deg, #E86B10 0 50%, #12915E 50% 100%)" }}
            />
            Try it — ask for a real plan
          </span>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-green-600">demo</span>
        </div>

        <div className="flex min-h-[236px] max-h-[300px] flex-col gap-3 overflow-auto p-[18px]">
          {!active && (
            <p className="text-sm leading-relaxed text-ink-600">
              Tell me the group, the budget, and the date — I&rsquo;ll come back
              with a bookable plan and a ledger line. Pick one to watch it
              work.
            </p>
          )}

          {active && (
            <div className="ml-auto w-fit max-w-[88%] rounded-[12px_12px_3px_12px] bg-orange-500 px-3.5 py-2.5 text-sm leading-relaxed text-white">
              {input}
              {typing && (
                <span aria-hidden className="ml-0.5 animate-pulse-dot">
                  ▍
                </span>
              )}
            </div>
          )}

          {!typing && active && !revealed && (
            <div className="w-fit rounded-xl border border-paper-line bg-paper px-3.5 py-2.5 font-mono text-xs text-ink-500">
              drafting the plan…
            </div>
          )}

          {revealed && active && (
            <div className="animate-slide-in rounded-md border border-paper-line bg-paper-off px-3.5 py-3">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-rust">
                {active.title}
              </div>
              <div className="mt-2 flex flex-col">
                {active.rows.map((row) => (
                  <div
                    key={row.k}
                    className="flex justify-between gap-3.5 border-b border-dashed border-paper-rule py-1.5 font-mono text-xs"
                  >
                    <span className="text-ink-600">{row.k}</span>
                    <span className="text-ink-900">{row.v}</span>
                  </div>
                ))}
              </div>
              <Link
                href={`/console?mode=${active.mode}`}
                className="mt-3 inline-block rounded-md bg-green-500 px-4 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-green-600"
              >
                {active.cta}
              </Link>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 px-[18px] pb-2.5">
          {CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => playDemo(chip)}
              disabled={typing}
              className="rounded-full border border-dashed border-paper-rule bg-paper px-3 py-1.5 text-xs text-ink-600 transition-transform hover:-translate-y-px hover:border-orange-500 hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5 border-t border-dashed border-paper-rule px-[18px] py-[14px]">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="60 households, ₹85,000, Nov 8…"
            aria-label="Ask the concierge"
            className="min-w-0 flex-1 rounded-lg border border-paper-rule px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400"
          />
          <button
            type="button"
            aria-label="Send to the concierge"
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg transition-[filter] hover:brightness-110"
            style={{ background: "linear-gradient(115deg, #E86B10, #12915E)" }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 12h15M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </section>
    </div>
  );
}
