// Organization + CSR budget state, keyed by the server-issued orgId from
// lib/server/session.ts. Replaces lib/second-helping/corporateStore.ts, whose
// key was a model-chosen slug.
//
// STORAGE IS STILL IN-MEMORY AND STILL RESETS ON RESTART. That is the next
// piece of work, not this one. What changed here is the *shape*: everything
// goes through OrgRepository, so swapping the in-memory implementation for
// Postgres/Prisma is a single new class and one line in `repo`, with no caller
// touched. Don't add direct Map access anywhere outside this file.
//
// The ledger table the CTO brief calls "the product" belongs here too, as a
// second repository, once persistence lands — appends only, never updates.

export type Org = {
  orgId: string;
  name: string;
  budgetTotalInr: number;
  budgetSpentInr: number;
  fiscalYearEnd: string; // e.g. "March 31"
  /** The CSR admin who registered this org. Maker-checker compares against it:
   *  whoever this is cannot also be the approver. Without a proposer identity,
   *  "the proposer can't approve" has nothing to compare and the rule is a
   *  no-op — which is why it's required, not optional. */
  adminEmail: string;
  createdAt: number;
};

export interface OrgRepository {
  get(orgId: string): Promise<Org | null>;
  upsert(
    orgId: string,
    input: { name: string; budgetTotalInr: number; adminEmail: string; fiscalYearEnd?: string }
  ): Promise<Org>;
  recordSpend(orgId: string, amountInr: number): Promise<Org | null>;
}

class InMemoryOrgRepository implements OrgRepository {
  private orgs = new Map<string, Org>();

  async get(orgId: string): Promise<Org | null> {
    return this.orgs.get(orgId) ?? null;
  }

  async upsert(
    orgId: string,
    input: { name: string; budgetTotalInr: number; adminEmail: string; fiscalYearEnd?: string }
  ): Promise<Org> {
    const existing = this.orgs.get(orgId);
    const next: Org = {
      orgId,
      name: input.name,
      budgetTotalInr: input.budgetTotalInr,
      adminEmail: input.adminEmail.trim().toLowerCase(),
      // Spend is never reset by a profile edit — changing your budget must not
      // silently wipe what you've already committed.
      budgetSpentInr: existing?.budgetSpentInr ?? 0,
      fiscalYearEnd: input.fiscalYearEnd ?? existing?.fiscalYearEnd ?? "March 31",
      createdAt: existing?.createdAt ?? Date.now(),
    };
    this.orgs.set(orgId, next);
    return next;
  }

  async recordSpend(orgId: string, amountInr: number): Promise<Org | null> {
    const existing = this.orgs.get(orgId);
    if (!existing) return null;
    existing.budgetSpentInr += amountInr;
    return existing;
  }
}

// Survives Next.js dev hot-reloads, which otherwise re-evaluate this module and
// drop every registered org mid-session.
const globalForRepo = globalThis as unknown as { __glOrgRepo?: OrgRepository };

export const repo: OrgRepository = globalForRepo.__glOrgRepo ?? new InMemoryOrgRepository();
if (process.env.NODE_ENV !== "production") globalForRepo.__glOrgRepo = repo;
