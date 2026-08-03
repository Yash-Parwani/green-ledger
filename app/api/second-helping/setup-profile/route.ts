import { repo } from "@/lib/server/orgStore";
import { ledger } from "@/lib/server/ledger";
import { getSession, createSession, clearSession } from "@/lib/server/session";

export const runtime = "nodejs";

// The organization's identity lives here, server-side, behind a signed
// httpOnly session cookie. The client sends a name and a budget; it does NOT
// send — and cannot choose — the org id it lands under. Corporate identity
// must never go back into localStorage.

const MAX_BUDGET_INR = 100_000_000_000; // ₹10,000 Cr — a sanity ceiling, not a policy limit

/** Register (or update) this session's organization, issuing a session if needed. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { corporate_name, annual_budget_inr, admin_email, fiscal_year_end } = (body ?? {}) as {
    corporate_name?: string;
    annual_budget_inr?: number;
    admin_email?: string;
    fiscal_year_end?: string;
  };

  const name = corporate_name?.trim();
  if (!name) {
    return Response.json({ error: "corporate_name is required" }, { status: 400 });
  }
  // Required, not optional: maker-checker compares the approver against this.
  // Without it there is no proposer identity and the rule silently no-ops.
  const adminEmail = admin_email?.trim().toLowerCase();
  if (!adminEmail || !adminEmail.includes("@")) {
    return Response.json(
      { error: "admin_email is required — it's the identity maker-checker approval is measured against" },
      { status: 400 }
    );
  }
  if (
    typeof annual_budget_inr !== "number" ||
    !Number.isFinite(annual_budget_inr) ||
    annual_budget_inr <= 0 ||
    annual_budget_inr > MAX_BUDGET_INR
  ) {
    return Response.json(
      { error: "annual_budget_inr must be a positive number below ₹10,000 Cr" },
      { status: 400 }
    );
  }

  const session = (await getSession()) ?? (await createSession());
  const org = await repo.upsert(session.orgId, {
    name,
    budgetTotalInr: annual_budget_inr,
    adminEmail,
    fiscalYearEnd: fiscal_year_end,
  });

  return Response.json(toClient(org));
}

/** Read this session's organization, so the console hydrates from the server. */
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ profile: null });
  const org = await repo.get(session.orgId);
  if (!org) return Response.json({ profile: null });
  // Spend derives from the ledger, same as csr_budget_status — the console and
  // the agent must never quote different numbers for the same budget.
  const spent = await ledger.totalCommittedInr(session.orgId);
  return Response.json({ profile: { ...toClient(org), budget_spent_inr: spent } });
}

/** Sign out of this organization. */
export async function DELETE() {
  await clearSession();
  return Response.json({ ok: true });
}

// Note the absence of orgId — the client has no use for it and shipping it
// only invites someone to start passing it back.
function toClient(org: Awaited<ReturnType<typeof repo.get>>) {
  if (!org) return null;
  return {
    corporate_name: org.name,
    annual_budget_inr: org.budgetTotalInr,
    budget_spent_inr: org.budgetSpentInr,
    admin_email: org.adminEmail,
    fiscal_year_end: org.fiscalYearEnd,
  };
}
