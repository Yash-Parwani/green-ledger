"use client";

import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/shared/cn";

export type TrajEntry =
  | { kind: "text"; text: string }
  | { kind: "tool_use"; name: string; input: unknown; id: string }
  | { kind: "tool_result"; id: string; output: unknown };

export type ToolSourceMap = Record<string, { label: string; className: string }>;

export function ToolTrajectory({
  trajectory,
  sourceMap,
  emptyHint,
  title = "Live MCP calls",
}: {
  trajectory: TrajEntry[];
  sourceMap: ToolSourceMap;
  emptyHint: string;
  title?: string;
}) {
  const uses = trajectory.filter((t): t is Extract<TrajEntry, { kind: "tool_use" }> => t.kind === "tool_use");
  const latest = uses[uses.length - 1];

  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">{title}</h2>
      {/* Visually-hidden live region: screen readers hear each new tool call as it streams in. */}
      <div aria-live="polite" className="sr-only">
        {latest ? `Calling ${sourceMap[latest.name]?.label ?? "tool"}: ${latest.name}` : ""}
      </div>
      {uses.length === 0 ? (
        <p className="text-xs italic text-ink-400">{emptyHint}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {uses.slice(-14).map((t) => {
              const result = trajectory.find(
                (r): r is Extract<TrajEntry, { kind: "tool_result" }> =>
                  r.kind === "tool_result" && r.id === t.id
              );
              const isError = result && !(result.output as { ok?: boolean })?.ok;
              const src = sourceMap[t.name];
              return (
                <motion.li
                  key={t.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "rounded-lg border px-2.5 py-2 text-xs",
                    isError ? "border-red-300 bg-red-50" : "border-ink-200 bg-ink-50/60"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-ink-700">{t.name}</span>
                    {src && (
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", src.className)}>
                        {src.label}
                      </span>
                    )}
                  </div>
                  {isError && (
                    <div className="mt-1 text-[11px] text-red-600">
                      ⚠ {String((result?.output as { error?: string })?.error ?? "error")}
                    </div>
                  )}
                  {!result && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-ink-400">
                      <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-orange-500" />
                      running…
                    </div>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
