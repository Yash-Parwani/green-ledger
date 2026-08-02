"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

// Donee verification, deliberately a human surface. The agent is blocked from
// committing spend to an unverified NGO and has no tool to verify one — if it
// could clear its own blocker, the block would be decorative.

type Ngo = {
  name: string;
  reg80g?: string;
  reg12a?: string;
  verified: boolean;
};

export function DoneesPanel({ refreshKey }: { refreshKey: number }) {
  const [ngos, setNgos] = useState<Ngo[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [reg80g, setReg80g] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/second-helping/ngos");
      const { ngos: n } = await res.json();
      setNgos(n ?? []);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/second-helping/ngos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), reg_80g: reg80g.trim(), verify: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not verify that donee.");
      } else {
        setName("");
        setReg80g("");
        setOpen(false);
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-500">Verified donees</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-[11px] text-ink-500 underline underline-offset-2 hover:text-ink-800"
        >
          {open ? "cancel" : "+ verify"}
        </button>
      </div>

      {ngos.length === 0 && !open && (
        <p className="mt-2 text-[11px] italic text-ink-400">
          None yet. Spend to an unverified donee is blocked by policy.
        </p>
      )}

      {open && (
        <div className="mt-3 flex flex-col gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="NGO name, e.g. Asha Kiran"
            className="rounded-lg border border-ink-200 px-3 py-2 text-xs focus:border-green-400 focus:outline-none"
          />
          <input
            value={reg80g}
            onChange={(e) => setReg80g(e.target.value)}
            placeholder="80G registration no."
            className="rounded-lg border border-ink-200 px-3 py-2 text-xs focus:border-green-400 focus:outline-none"
          />
          <p className="text-[11px] leading-snug text-ink-500">
            You are confirming you have seen this donee&rsquo;s registration documents.
          </p>
          <Button
            onClick={verify}
            disabled={busy || !name.trim() || !reg80g.trim()}
            variant="success"
            className="self-start !px-3 !py-1 !text-[11px]"
          >
            {busy ? "Verifying…" : "Verify donee"}
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-[11px] text-orange-700">
          {error}
        </p>
      )}

      {ngos.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          {ngos.map((n) => (
            <div key={n.name} className="flex items-center justify-between text-xs">
              <span className="text-ink-700">{n.name}</span>
              <span
                className={
                  n.verified
                    ? "rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700"
                    : "rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-700"
                }
              >
                {n.verified ? `80G ${n.reg80g ?? "on file"}` : "unverified"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
