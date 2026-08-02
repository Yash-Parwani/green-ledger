"use client";

export function QuickReplyChips({
  options,
  onPick,
  disabled,
}: {
  options: string[];
  onPick: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label="Quick replies" className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          disabled={disabled}
          onClick={() => onPick(opt)}
          className="rounded-full border border-orange-200 bg-orange-50 px-3.5 py-1.5 text-xs font-medium text-orange-700 transition-colors hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
