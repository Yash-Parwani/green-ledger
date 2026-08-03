"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

// Inline approval, rendered in the chat right where the agent proposed the
// spend. Approving something you were just shown, in the place you were shown
// it, is the whole point — making someone hunt for a side panel is how
// approvals become reflexive.
//
// Two shapes, decided by the server, not here:
//   normal — one click, the signed-in admin approves as themselves
//   escalated — a second approver's email is required
//
// The escalated shape is currently unreachable: dual approval is off until a
// second approver can actually be notified out of band. The path stays because
// turning it back on should be a threshold plus a notification, not a rebuild.
// See Org.dualApprovalThresholdInr.
//
// The UI reflects the server's decision; it does not make it. A hand-crafted
// request still has to get past the same check in lib/server/proposals.ts.

type Proposal = {
  id: string;
  toolName: string;
  toolInput: unknown;
  summary: string;
  amountInr: number | null;
  ngoName?: string;
  status: "awaiting_approval" | "approved" | "rejected" | "executed";
  requiresSecondApprover: boolean;
  proposedByEmail: string;
  approvedByEmail?: string;
};

export function ApprovalCard({
  proposalId,
  onDecided,
}: {
  proposalId: string;
  onDecided?: (proposalId: string, executed?: { toolName: string; toolInput: unknown; output: unknown }) => void;
}) {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [thresholdInr, setThresholdInr] = useState<number | null>(null);
  const [secondEmail, setSecondEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/second-helping/approvals");
      const { proposals, thresholdInr: t } = (await res.json()) as {
        proposals: Proposal[];
        thresholdInr: number | null;
      };
      setProposal(proposals?.find((p) => p.id === proposalId) ?? null);
      setThresholdInr(t);
    } catch {
      // non-critical: the approvals panel is still a working fallback
    }
  }, [proposalId]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(action: "approve" | "reject") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/second-helping/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: proposalId,
          action,
          // Omitted below the threshold — the server signs as the admin of
          // record. Above it, this is the second identity.
          ...(proposal?.requiresSecondApprover ? { approver_email: secondEmail.trim() } : {}),
          ...(action === "reject" ? { reason: "Rejected in console" } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Could not record that decision.");
      await load();
      // Hand the execution back so the console can put it on the trajectory —
      // otherwise the commitment is invisible to the chat that proposed it.
      onDecided?.(
        proposalId,
        res.ok && data.execution && proposal
          ? { toolName: proposal.toolName, toolInput: proposal.toolInput, output: data.execution }
          : undefined
      );
    } finally {
      setBusy(false);
    }
  }

  if (!proposal) return null;

  const settled = proposal.status !== "awaiting_approval";
  const amount =
    proposal.amountInr != null
      ? `₹${proposal.amountInr.toLocaleString("en-IN")}`
      : "total not priced yet";

  // Two different reasons land in the same `requiresSecondApprover` flag, and
  // saying the wrong one is worse than saying nothing: a ₹35,880 order labelled
  // "above your ₹5,00,000 threshold" is a claim the CFO can see is false.
  const escalatedForUnknownAmount = proposal.requiresSecondApprover && proposal.amountInr == null;
  const threshold = thresholdInr != null ? `₹${thresholdInr.toLocaleString("en-IN")}` : "the";

  return (
    <div
      className={`rounded-xl border p-4 ${
        settled ? "border-green-300 bg-green-50/60" : "border-orange-300 bg-orange-50/60"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
          {settled ? "Approved" : "Needs approval"}
        </p>
        {proposal.requiresSecondApprover && !settled && (
          <span className="rounded-full border border-orange-300 bg-white px-2 py-0.5 text-[10px] font-medium text-orange-700">
            Second approver required
          </span>
        )}
      </div>

      <p className="mt-1.5 text-sm font-medium text-ink-800">{proposal.summary}</p>
      <p className="mt-0.5 text-xs text-ink-500">
        {amount} · proposed by {proposal.proposedByEmail}
        {settled && proposal.approvedByEmail && ` · signed off by ${proposal.approvedByEmail}`}
      </p>

      {!settled && (
        <>
          {proposal.requiresSecondApprover ? (
            <>
              <p className="mt-2.5 text-xs leading-snug text-ink-600">
                {escalatedForUnknownAmount ? (
                  <>
                    The total hasn&rsquo;t been priced yet, so this escalates by default —{" "}
                    {proposal.proposedByEmail} can&rsquo;t sign off on a figure nobody has seen. Ask the
                    agent to quote it first and it may come back under your {threshold} threshold, or
                    enter a second approver&rsquo;s email to proceed anyway.
                  </>
                ) : (
                  <>
                    Above your {threshold} second-approver threshold, so {proposal.proposedByEmail}{" "}
                    can&rsquo;t sign this one off. Enter the second approver&rsquo;s email.
                  </>
                )}
              </p>
              <input
                value={secondEmail}
                onChange={(e) => setSecondEmail(e.target.value)}
                placeholder="Second approver's email"
                type="email"
                className="mt-2 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs text-ink-800 placeholder:text-ink-400 focus:border-orange-400 focus:outline-none"
              />
            </>
          ) : (
            <p className="mt-2.5 text-xs leading-snug text-ink-600">
              You&rsquo;re signing this off as {proposal.proposedByEmail}. The approval is bound to
              these exact figures — change the amount, donee or cadence and it needs approving again.
            </p>
          )}

          {error && (
            <p role="alert" className="mt-2 text-[11px] text-orange-800">
              {error}
            </p>
          )}

          <div className="mt-3 flex gap-2">
            <Button
              onClick={() => decide("approve")}
              disabled={busy || (proposal.requiresSecondApprover && !secondEmail.includes("@"))}
              variant="success"
              className="!px-3 !py-1.5 !text-xs"
            >
              {busy ? "Recording…" : "Approve"}
            </Button>
            <Button
              onClick={() => decide("reject")}
              disabled={busy || (proposal.requiresSecondApprover && !secondEmail.includes("@"))}
              className="!px-3 !py-1.5 !text-xs"
            >
              Reject
            </Button>
          </div>
        </>
      )}

      {settled && (
        <p className="mt-2 text-xs text-ink-600">
          Tell the agent to go ahead and it will execute against these exact figures.
        </p>
      )}
    </div>
  );
}
