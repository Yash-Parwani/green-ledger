"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/shared/cn";

export type PaymentSimulatedLine = {
  label: string;
  meta?: string;
  amount?: string;
};

export function PaymentSimulatedCard({
  label,
  accent = "green",
  ngo,
  lines,
  perDrop,
  total,
  note,
}: {
  label: string;
  accent?: "orange" | "green";
  ngo?: string;
  lines: PaymentSimulatedLine[];
  perDrop?: string;
  total?: string;
  note: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "w-full rounded-2xl border bg-white p-3.5 shadow-sm",
        accent === "orange" ? "border-orange-200" : "border-green-200"
      )}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span
          className={cn(
            "text-[11px] font-semibold uppercase tracking-wide",
            accent === "orange" ? "text-orange-600" : "text-green-600"
          )}
        >
          {label}
          {ngo ? ` · ${ngo}` : ""}
        </span>
        <span className="shrink-0 rounded-full border border-ink-300 bg-ink-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-500">
          Cart real · Payment simulated
        </span>
      </div>

      <ul className="flex flex-col gap-1.5">
        {lines.map((l, i) => (
          <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-ink-800">
              {l.label}
              {l.meta && <span className="ml-1.5 text-[11px] text-ink-500">{l.meta}</span>}
            </span>
            {l.amount && <span className="shrink-0 font-mono text-[13px] text-ink-900">{l.amount}</span>}
          </li>
        ))}
      </ul>

      {(perDrop || total) && (
        <div className="my-2.5 border-t border-dashed border-ink-200" aria-hidden />
      )}
      {(perDrop || total) && (
        <div className="flex items-center justify-between text-xs text-ink-600">
          {perDrop && (
            <span>
              This drop <span className="font-mono text-ink-900">{perDrop}</span>
            </span>
          )}
          {total && (
            <span>
              Programme earmarked <span className="font-mono font-semibold text-ink-900">{total}</span>
            </span>
          )}
        </div>
      )}

      <p className="mt-2.5 text-[11px] leading-snug text-ink-500">{note}</p>
    </motion.div>
  );
}
