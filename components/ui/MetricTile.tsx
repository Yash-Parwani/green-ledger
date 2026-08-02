import { cn } from "@/lib/shared/cn";

export function MetricTile({
  label,
  value,
  delta,
  accent = "ink",
}: {
  label: string;
  value: string;
  delta?: string;
  accent?: "ink" | "orange" | "green";
}) {
  const valueColor =
    accent === "orange" ? "text-orange-600" : accent === "green" ? "text-green-600" : "text-ink-900";
  return (
    <div className="rounded-xl border border-ink-200 bg-white px-3.5 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-ink-500">{label}</div>
      <div className={cn("mt-0.5 text-xl font-semibold tabular-nums", valueColor)}>{value}</div>
      {delta && <div className="mt-0.5 text-[11px] text-ink-500">{delta}</div>}
    </div>
  );
}
