"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/shared/cn";

type Status = { enabled: boolean; connected: boolean } | null;

export function SwiggyConnect() {
  const [status, setStatus] = useState<Status>(null);

  useEffect(() => {
    fetch("/api/auth/swiggy/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  if (!status?.enabled) return null;

  async function disconnect() {
    await fetch("/api/auth/swiggy/logout", { method: "POST" });
    setStatus((s) => (s ? { ...s, connected: false } : s));
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className={cn(
          "inline-flex h-2 w-2 rounded-full",
          status.connected ? "bg-green-500" : "bg-ink-200"
        )}
        aria-hidden
      />
      {status.connected ? (
        <>
          <span className="text-ink-500">Swiggy connected</span>
          <button type="button" onClick={disconnect} className="font-medium text-ink-800 underline underline-offset-2">
            Disconnect
          </button>
        </>
      ) : (
        <a
          href="/api/auth/swiggy/authorize"
          className="font-medium text-ink-800 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500"
        >
          Connect Swiggy account
        </a>
      )}
    </div>
  );
}
