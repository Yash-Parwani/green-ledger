import { ledger } from "@/lib/server/ledger";
import { getSession } from "@/lib/server/session";

export const runtime = "nodejs";

/** The audit trail for this session's organization. Read-only by construction —
 *  the repository has no update or delete. */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ entries: [], totalCommittedInr: 0 });

  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 100);
  const [entries, totalCommittedInr] = await Promise.all([
    ledger.list(session.orgId, { limit: Math.min(Math.max(limit, 1), 500) }),
    ledger.totalCommittedInr(session.orgId),
  ]);

  return Response.json({ entries, totalCommittedInr });
}
