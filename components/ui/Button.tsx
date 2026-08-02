"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/shared/cn";

type Variant = "primary" | "secondary" | "ghost" | "success";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700 disabled:bg-orange-300",
  secondary: "bg-ink-100 text-ink-800 hover:bg-ink-200",
  ghost: "bg-transparent text-ink-600 hover:bg-ink-100",
  success:
    "bg-green-500 text-white hover:bg-green-600 active:bg-green-700 disabled:bg-green-300",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
};

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }
>(function Button({ className, variant = "primary", size = "md", ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    />
  );
});
