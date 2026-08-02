"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/shared/cn";

export function ImageUpload({
  onFile,
  disabled,
  label = "Attach a screenshot or spreadsheet",
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        aria-label={label}
        title={label}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors",
          dragOver
            ? "border-green-500 bg-green-50 text-green-600"
            : "border-ink-200 bg-white text-ink-500 hover:border-green-300 hover:text-green-600"
        )}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden>
          <path
            d="M12 4v12m0-12 4 4m-4-4-4 4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.csv,.xlsx,.xls"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </>
  );
}
