"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/shared/cn";
import { Button } from "./Button";

export type PlanOption = {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string[];
  price?: string;
};

export function PlanCard({
  label,
  accent = "orange",
  options,
  selectedId,
  onSelect,
  onSwap,
  swapping,
}: {
  label: string;
  accent?: "orange" | "green";
  options: PlanOption[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onSwap?: () => void;
  swapping?: boolean;
}) {
  const accentClasses = accent === "orange" ? "border-orange-200" : "border-green-200";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn("w-full rounded-2xl border bg-white p-3.5 shadow-sm", accentClasses)}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <span
          className={cn(
            "text-[11px] font-semibold uppercase tracking-wide",
            accent === "orange" ? "text-orange-600" : "text-green-600"
          )}
        >
          {label}
        </span>
        {onSwap && (
          <Button variant="ghost" size="sm" onClick={onSwap} disabled={swapping} aria-label={`Find other ${label.toLowerCase()} options`}>
            {swapping ? "Searching…" : "↻ Swap"}
          </Button>
        )}
      </div>
      <div role="radiogroup" aria-label={label} className="flex flex-col gap-2">
        {options.map((opt) => {
          const selected = opt.id === selectedId;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(opt.id)}
              className={cn(
                "flex w-full items-start justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors",
                selected
                  ? accent === "orange"
                    ? "border-orange-400 bg-orange-50"
                    : "border-green-400 bg-green-50"
                  : "border-ink-200 hover:border-ink-300 hover:bg-ink-50"
              )}
            >
              <span>
                <span className="block font-medium text-ink-800">{opt.title}</span>
                {opt.subtitle && <span className="mt-0.5 block text-xs text-ink-500">{opt.subtitle}</span>}
                {opt.meta && opt.meta.length > 0 && (
                  <span className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] text-ink-500">
                    {opt.meta.map((m) => (
                      <span key={m}>{m}</span>
                    ))}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                {opt.price && <span className="text-sm font-semibold text-ink-900">{opt.price}</span>}
                <span
                  aria-hidden
                  className={cn(
                    "h-4 w-4 rounded-full border-2",
                    selected
                      ? accent === "orange"
                        ? "border-orange-500 bg-orange-500"
                        : "border-green-500 bg-green-500"
                      : "border-ink-300"
                  )}
                />
              </span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
