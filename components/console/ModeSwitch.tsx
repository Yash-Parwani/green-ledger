"use client";

import { cn } from "@/lib/shared/cn";

export type ConsoleMode = "csr" | "community";

const MODES: { id: ConsoleMode; label: string; icon: string }[] = [
  { id: "csr", label: "CSR Program", icon: "⚡" },
  { id: "community", label: "Community Event", icon: "🍱" },
];

export function ModeSwitch({ mode, onChange }: { mode: ConsoleMode; onChange: (m: ConsoleMode) => void }) {
  return (
    <div
      role="radiogroup"
      aria-label="Choose what you're planning"
      className="inline-flex rounded-full border border-ink-200 bg-white p-1"
    >
      {MODES.map((m) => {
        const active = m.id === mode;
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(m.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              active
                ? m.id === "csr"
                  ? "bg-green-500 text-white"
                  : "bg-orange-500 text-white"
                : "text-ink-500 hover:text-ink-800"
            )}
          >
            <span aria-hidden>{m.icon}</span>
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
