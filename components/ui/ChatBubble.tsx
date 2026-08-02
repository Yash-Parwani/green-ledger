"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/shared/cn";

export function ChatBubble({
  role,
  children,
  author,
  timestamp,
}: {
  role: "user" | "assistant";
  children: React.ReactNode;
  author?: string;
  timestamp?: string;
}) {
  const isUser = role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("flex gap-2.5", isUser ? "flex-row-reverse" : "flex-row")}
    >
      <div
        aria-hidden
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white",
          isUser ? "bg-ink-500" : "bg-gradient-to-br from-orange-500 to-green-500"
        )}
      >
        {isUser ? "YOU" : "AI"}
      </div>
      <div className={cn("flex max-w-[80%] flex-col gap-1", isUser ? "items-end" : "items-start")}>
        {(author || timestamp) && (
          <div className="flex items-baseline gap-1.5 px-1 text-[11px] text-ink-500">
            {author && <span className="font-medium text-ink-600">{author}</span>}
            {timestamp && <span>{timestamp}</span>}
          </div>
        )}
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "rounded-tr-sm bg-orange-500 text-white"
              : "rounded-tl-sm border border-ink-200 bg-white text-ink-800"
          )}
        >
          {children}
        </div>
      </div>
    </motion.div>
  );
}
