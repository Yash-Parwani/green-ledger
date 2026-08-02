import { proposals } from "@/lib/server/proposals";
import { ledger } from "@/lib/server/ledger";
import { repo } from "@/lib/server/orgStore";
import { getSession, toAgentContext } from "@/lib/server/session";
import { createToolImpls as createCsrToolImpls } from "@/lib/second-helping/tool-impls";
import { createToolImpls as createGcToolImpls } from "@/lib/group-concierge/tool-impls";

export const runtime = "nodejs";

/** Proposals awaiting a human, plus recently decided ones. */
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ proposals: [], thresholdInr: null });
  const [list, org] = await Promise.all([proposals.list(session.orgId), repo.get(session.orgId)]);
  // The threshold ships with the list so the UI can state the real figure
  // rather than repeating a hardcoded one that drifts from the org's setting.
  return Response.json({ proposals: list, thresholdInr: org?.dualApprovalThresholdInr ?? null });
}

/** Approve or reject. Maker-checker is enforced in the repository, not here. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { id, action, approver_email, reason } = (body ?? {}) as {
    id?: string;
    action?: "approve" | "reject";
    approver_email?: string;
    reason?: string;
  };

  if (!id || (action !== "approve" && action !== "reject")) {
    return Response.json({ error: "id and action ('approve' | 'reject') are required" }, { status: 400 });
  }

  const proposal = await proposals.get(session.orgId, id);
  if (!proposal) return Response.json({ error: "No such proposal." }, { status: 404 });

  // Below the threshold the signed-in admin approves as themselves — one
  // click, nothing to type. Above it a second identity is required, and it
  // must be supplied explicitly: defaulting to the signed-in user there would
  // silently defeat maker-checker.
  const org = await repo.get(session.orgId);
  const email = proposal.requiresSecondApprover
    ? approver_email?.trim().toLowerCase()
    : (approver_email?.trim().toLowerCase() || org?.adminEmail);

  if (!email || !email.includes("@")) {
    return Response.json(
      {
        error: proposal.requiresSecondApprover
          ? "This commitment is above the second-approver threshold — a second approver's email is required."
          : "A valid approver_email is required",
      },
      { status: 400 }
    );
  }

  const result =
    action === "approve"
      ? await proposals.approve(session.orgId, id, { email })
      : await proposals.reject(session.orgId, id, { email }, reason ?? "No reason given");

  if ("error" in result) return Response.json({ error: result.error }, { status: 409 });

  await ledger.append({
    orgId: session.orgId,
    kind: "approval",
    amountInr: null,
    actor: { userId: session.userId, role: session.role },
    toolName: result.toolName,
    toolInput: result.toolInput,
    summary:
      action === "approve"
        ? `Approved by ${email}: ${result.summary}`
        : `Rejected by ${email}: ${result.summary} — ${result.rejectedReason}`,
    ngoName: result.ngoName,
  });

  if (action === "reject") return Response.json({ proposal: result });

  // Approving RUNS it. Previously approval only unlocked the call and something
  // else had to make it again — so a proposal could sit approved-but-never-
  // executed with no commitment on the ledger and no spend against budget,
  // while the agent, having seen the approval, reported the programme as
  // registered. "I approved it" has to mean "it happened".
  //
  // This goes back through the same policy-wrapped implementations, so the gate
  // re-runs, finds the now-approved proposal matching this exact call hash,
  // allows it, and writes the commitment to the ledger. The gate stays the
  // single enforcement point; nothing here bypasses it.
  const ctx = toAgentContext(session);
  const impls = { ...createCsrToolImpls(ctx), ...createGcToolImpls(ctx) } as Record<
    string,
    (input: never) => Promise<unknown>
  >;
  const impl = impls[result.toolName];
  if (!impl) {
    return Response.json({
      proposal: result,
      execution: { ok: false, error: `Approved, but no implementation for ${result.toolName}.` },
    });
  }

  try {
    const execution = await impl(result.toolInput as never);
    return Response.json({ proposal: await proposals.get(session.orgId, id), execution });
  } catch (err) {
    // The approval stands — the execution failed. Say so rather than letting
    // the caller assume a green tick means it landed.
    return Response.json({
      proposal: result,
      execution: { ok: false, error: `Approved, but execution failed: ${(err as Error).message}` },
    });
  }
}
