import { cn } from "@/lib/shared/cn";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-ink-200/80 bg-white shadow-sm",
        className
      )}
      {...props}
    />
  );
}
