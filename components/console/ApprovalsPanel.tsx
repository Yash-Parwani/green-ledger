"use client";

import { useCallback, useEffect, useState } from "react";

// A read-only queue. Approving happens on the inline card in the chat, where
// the agent raised it — this panel duplicated those controls, so a single
// pending proposal rendered two Approve buttons and two "second approver's
// email" fields side by side. Two ways to do one thing, one of them detached
// from the message that explains what you're signing.
//
// What a queue is genuinely useful for is the count and the history, so that's
// all this does now. Don't add action buttons back.

type Proposal = {
  id: string;
  amountInr: number | null;
  summary: string;
  status: "awaiting_approval" | "approved" | "rejected" | "executed";
  requiresSecondApprover: boolean;
  proposedByEmail: string;
  approvedByEmail?: string;
};

const STATUS_LABEL: Record<Proposal["status"], string> = {
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  executed: "Executed",
  rejected: "Rejected",
};

const STATUS_STYLE: Record<Proposal["status"], string> = {
  awaiting_approval: "border-orange-300 bg-orange-50/70",
  approved: "border-green-300 bg-green-50/70",
  executed: "border-green-300 bg-green-50/70",
  rejected: "border-ink-200 bg-ink-50",
};

export function ApprovalsPanel({ refreshKey }: { refreshKey: number }) {
  const [proposals, setProposals] = useState<Proposal[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/second-helping/approvals");
      const { proposals: p } = await res.json();
      setProposals(p ?? []);
    } catch {
      // panel is non-critical; keep whatever we last had
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (proposals.length === 0) return null;

  const pending = proposals.filter((p) => p.status === "awaiting_approval").length;

  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-4">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
        Approvals {pending > 0 && <span className="text-orange-600">· {pending} pending</span>}
      </h2>
      <p className="mb-3 text-[11px] leading-snug text-ink-500">
        {pending > 0
          ? "Approve in the chat, under the message that proposed it."
          : "Every commitment, and who signed it off."}
      </p>

      <div className="flex flex-col gap-1.5">
        {proposals.slice(0, 6).map((p) => (
          <div key={p.id} className={`rounded-lg border px-3 py-2 ${STATUS_STYLE[p.status]}`}>
            <p className="text-[11px] font-medium leading-snug text-ink-800">{p.summary}</p>
            <p className="mt-0.5 text-[10px] text-ink-500">
              {STATUS_LABEL[p.status]}
              {p.amountInr != null && ` · ₹${p.amountInr.toLocaleString("en-IN")}`}
              {p.approvedByEmail
                ? ` · ${p.approvedByEmail}`
                : p.requiresSecondApprover
                  ? " · needs a second approver"
                  : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
