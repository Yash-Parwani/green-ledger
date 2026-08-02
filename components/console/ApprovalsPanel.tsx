"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

// The human-in-the-loop surface. A pending proposal here is money the agent
// wanted to commit and the policy engine stopped. Approving is a deliberate,
// identified act — the approver types who they are, and the server refuses if
// that's the same person who proposed it.

type Proposal = {
  id: string;
  toolName: string;
  amountInr: number | null;
  ngoName?: string;
  summary: string;
  status: "awaiting_approval" | "approved" | "rejected" | "executed";
  requiresSecondApprover: boolean;
  proposedByEmail: string;
  proposedAt: number;
  approvedByEmail?: string;
  rejectedReason?: string;
};

const STATUS_STYLE: Record<Proposal["status"], string> = {
  awaiting_approval: "border-orange-300 bg-orange-50 text-orange-700",
  approved: "border-green-300 bg-green-50 text-green-700",
  executed: "border-green-300 bg-green-50 text-green-700",
  rejected: "border-ink-300 bg-ink-50 text-ink-600",
};

export function ApprovalsPanel({ refreshKey }: { refreshKey: number }) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [approverEmail, setApproverEmail] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/second-helping/approvals");
      const { proposals: p } = await res.json();
      setProposals(p ?? []);
    } catch {
      // panel is non-critical; leave whatever we last had
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function decide(id: string, action: "approve" | "reject", needsSecond: boolean) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/second-helping/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action,
          // Only sent when a second identity is actually required; below the
          // threshold the server signs as the admin of record.
          ...(needsSecond ? { approver_email: approverEmail.trim() } : {}),
          reason: action === "reject" ? "Rejected in console" : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Could not record that decision.");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const pending = proposals.filter((p) => p.status === "awaiting_approval");
  const decided = proposals.filter((p) => p.status !== "awaiting_approval").slice(0, 3);

  if (proposals.length === 0) return null;

  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-4">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
        Approvals {pending.length > 0 && <span className="text-orange-600">· {pending.length} pending</span>}
      </h2>
      <p className="mb-3 text-[11px] leading-snug text-ink-500">
        Spend the agent proposed and policy held. Approval is bound to these exact figures.
      </p>

      {pending.some((p) => p.requiresSecondApprover) && (
        <input
          value={approverEmail}
          onChange={(e) => setApproverEmail(e.target.value)}
          placeholder="Second approver's email"
          type="email"
          className="mb-3 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs text-ink-800 placeholder:text-ink-400 focus:border-orange-400 focus:outline-none"
        />
      )}

      {error && (
        <p role="alert" className="mb-3 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-[11px] text-orange-800">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {pending.map((p) => (
          <div key={p.id} className={`rounded-lg border px-3 py-2 ${STATUS_STYLE[p.status]}`}>
            <p className="text-xs font-medium text-ink-800">{p.summary}</p>
            <p className="mt-0.5 text-[11px] text-ink-500">
              Proposed by {p.proposedByEmail}
              {p.amountInr !== null && ` · ₹${p.amountInr.toLocaleString("en-IN")}`}
              {p.requiresSecondApprover && " · needs a second approver"}
            </p>
            <div className="mt-2 flex gap-2">
              <Button
                onClick={() => decide(p.id, "approve", p.requiresSecondApprover)}
                disabled={busyId === p.id || (p.requiresSecondApprover && !approverEmail.includes("@"))}
                variant="success"
                className="!px-3 !py-1 !text-[11px]"
              >
                Approve
              </Button>
              <Button
                onClick={() => decide(p.id, "reject", p.requiresSecondApprover)}
                disabled={busyId === p.id || (p.requiresSecondApprover && !approverEmail.includes("@"))}
                className="!px-3 !py-1 !text-[11px]"
              >
                Reject
              </Button>
            </div>
          </div>
        ))}

        {decided.map((p) => (
          <div key={p.id} className={`rounded-lg border px-3 py-2 ${STATUS_STYLE[p.status]}`}>
            <p className="text-xs text-ink-700">{p.summary}</p>
            <p className="mt-0.5 text-[11px] capitalize">
              {p.status.replace("_", " ")}
              {p.approvedByEmail && ` · ${p.approvedByEmail}`}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
