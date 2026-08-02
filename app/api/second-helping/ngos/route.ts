import { ngos } from "@/lib/server/ngoStore";
import { ledger } from "@/lib/server/ledger";
import { getSession } from "@/lib/server/session";

export const runtime = "nodejs";

// NGO verification is a HUMAN action, which is why it lives on an HTTP route a
// person hits from the console and not behind a tool the agent can call. The
// agent is blocked from spending against an unverified donee; if it could also
// verify donees, that block would be worth nothing.

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ ngos: [] });
  return Response.json({ ngos: await ngos.list(session.orgId) });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in." }, { status: 401 });
  if (session.role !== "csr_admin" && session.role !== "approver") {
    return Response.json({ error: `Role "${session.role}" may not verify donees.` }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const { name, reg_80g, reg_12a, address, has_on_site_kitchen, verify } = (body ?? {}) as {
    name?: string;
    reg_80g?: string;
    reg_12a?: string;
    address?: string;
    has_on_site_kitchen?: boolean;
    verify?: boolean;
  };

  if (!name?.trim()) return Response.json({ error: "name is required" }, { status: 400 });

  await ngos.upsert({
    orgId: session.orgId,
    name: name.trim(),
    reg80g: reg_80g,
    reg12a: reg_12a,
    address,
    hasOnSiteKitchen: has_on_site_kitchen,
    verified: false,
  });

  if (verify) {
    if (!reg_80g?.trim() && !reg_12a?.trim()) {
      return Response.json(
        { error: "An 80G or 12A registration number is required to verify a donee." },
        { status: 400 }
      );
    }
    const verified = await ngos.markVerified(session.orgId, name.trim(), {
      reg80g: reg_80g,
      reg12a: reg_12a,
    });
    await ledger.append({
      orgId: session.orgId,
      kind: "document",
      amountInr: null,
      actor: { userId: session.userId, role: session.role },
      toolName: "verify_ngo",
      toolInput: { name, reg_80g, reg_12a },
      summary: `Donee verified: ${name} (80G ${reg_80g ?? "—"} / 12A ${reg_12a ?? "—"})`,
      ngoName: name.trim(),
    });
    return Response.json({ ngo: verified });
  }

  return Response.json({ ngo: await ngos.get(session.orgId, name.trim()) });
}
