import { proposals } from "@/lib/server/proposals";
import { ledger } from "@/lib/server/ledger";
import { getSession } from "@/lib/server/session";

export const runtime = "nodejs";

/** Proposals awaiting a human, plus recently decided ones. */
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ proposals: [] });
  return Response.json({ proposals: await proposals.list(session.orgId) });
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
  const email = approver_email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return Response.json({ error: "A valid approver_email is required" }, { status: 400 });
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

  return Response.json({ proposal: result });
}
