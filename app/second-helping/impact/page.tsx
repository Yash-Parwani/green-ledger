import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { ledger } from "@/lib/server/ledger";
import { repo } from "@/lib/server/orgStore";
import { getSession } from "@/lib/server/session";

// Rendered from the real append-only ledger for the signed-in organization.
//
// This page used to display hardcoded totals (184,620 meals, ₹2.18 Cr, 47 NGOs)
// with a small "illustrative" caption. On a page whose entire pitch is "every
// figure is auditable", invented figures are the one thing that can't be here —
// an empty ledger shown honestly is worth more than a full one that's fiction.
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  commitment: "Commitment",
  spend: "Spend",
  approval: "Approval",
  policy_refusal: "Policy refusal",
  document: "Document",
  correction: "Correction",
};

const KIND_STYLE: Record<string, string> = {
  commitment: "bg-green-50 text-green-700",
  spend: "bg-green-50 text-green-700",
  approval: "bg-green-50 text-green-700",
  policy_refusal: "bg-orange-50 text-orange-700",
  document: "bg-ink-100 text-ink-600",
  correction: "bg-ink-100 text-ink-600",
};

export default async function ImpactLedgerPage() {
  const session = await getSession();
  const org = session ? await repo.get(session.orgId) : null;
  const entries = session ? await ledger.list(session.orgId, { limit: 50 }) : [];

  const committed = entries
    .filter((e) => e.kind === "commitment" || e.kind === "spend")
    .reduce((sum, e) => sum + (e.amountInr ?? 0), 0);
  const refusals = entries.filter((e) => e.kind === "policy_refusal").length;
  const approvals = entries.filter((e) => e.kind === "approval").length;
  const donees = new Set(entries.map((e) => e.ngoName).filter(Boolean)).size;

  return (
    <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        Append-only · every row traceable to a tool call
      </div>
      <h1 className="font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">The Impact Ledger</h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-600">
        {org
          ? `Every rupee ${org.name} has committed through Second Helping, every approval, and every
             time the policy engine refused to spend — in the order it happened.`
          : `Every rupee committed through Second Helping, every approval, and every time the policy
             engine refused to spend — in the order it happened.`}
      </p>

      {!session || entries.length === 0 ? (
        <Card className="mt-10 p-6">
          <h2 className="text-sm font-semibold text-ink-900">Nothing on the ledger yet</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-600">
            {session
              ? "Nothing has been committed for this organization yet. Run a program in the console and every step will appear here."
              : "Register your organization in the console to start a ledger. This page shows real recorded activity only — there are no sample figures behind it."}
          </p>
          <Link
            href="/console?mode=csr"
            className="mt-4 inline-block rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            Open the console →
          </Link>
        </Card>
      ) : (
        <>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-500">CSR committed</p>
              <p className="mt-1 text-2xl font-semibold text-green-600">
                ₹<AnimatedCounter value={committed} />
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-500">Donees funded</p>
              <p className="mt-1 text-2xl font-semibold text-ink-900">
                <AnimatedCounter value={donees} />
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-500">Approvals</p>
              <p className="mt-1 text-2xl font-semibold text-ink-900">
                <AnimatedCounter value={approvals} />
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-500">Policy refusals</p>
              <p className="mt-1 text-2xl font-semibold text-orange-600">
                <AnimatedCounter value={refusals} />
              </p>
            </Card>
          </div>

          <div className="mt-12">
            <h2 className="mb-4 text-sm font-semibold text-ink-900">The trail</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-[11px] uppercase tracking-wide text-ink-500">
                    <th className="py-2 pr-3 font-medium">#</th>
                    <th className="py-2 pr-3 font-medium">Event</th>
                    <th className="py-2 pr-3 font-medium">Amount</th>
                    <th className="py-2 pr-3 font-medium">Detail</th>
                    <th className="py-2 font-medium">Tool</th>
                  </tr>
                </thead>
                <tbody>
                  {[...entries].reverse().map((e) => (
                    <tr key={e.id} className="border-b border-dashed border-ink-200 align-top">
                      <td className="py-2.5 pr-3 font-mono text-xs text-ink-400">{e.seq}</td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            KIND_STYLE[e.kind] ?? "bg-ink-100 text-ink-600"
                          }`}
                        >
                          {KIND_LABEL[e.kind] ?? e.kind}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-xs text-ink-700">
                        {e.amountInr ? `₹${e.amountInr.toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td className="max-w-sm py-2.5 pr-3 text-xs leading-snug text-ink-600">{e.summary}</td>
                      <td className="py-2.5 font-mono text-[11px] text-ink-400">{e.toolName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Card className="mt-12 p-5">
        <h2 className="text-sm font-semibold text-ink-900">Why refusals are on the ledger</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          An audit trail that only records what happened answers half the question. Recording what
          the system <em>refused</em> to do — and which rule stopped it — is what shows the controls
          were live at the time, not added afterwards. Nothing here is ever edited: corrections are
          appended as new rows pointing at what they supersede.
        </p>
      </Card>
    </div>
  );
}
