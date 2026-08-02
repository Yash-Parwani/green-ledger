// NGO registry with 80G/12A verification status.
//
// The policy engine refuses spend against an unverified donee, so this store is
// a control surface, not reference data. Two rules matter:
//
//   1. An NGO the org has never registered is UNVERIFIED, not unknown. Absence
//      is not permission — a typo'd or hallucinated NGO name must fail closed.
//   2. `verified` is set by a human reviewing registration documents. There is
//      deliberately no tool that lets the agent mark an NGO verified, and there
//      must never be one: that would let the model clear its own blocker.

export type Ngo = {
  orgId: string;
  name: string;
  reg80g?: string;
  reg12a?: string;
  verified: boolean;
  verifiedAt?: number;
  /** 80G registrations expire; the steward agent will chase this later. */
  registrationExpiresAt?: number;
  address?: string;
  hasOnSiteKitchen?: boolean;
};

export interface NgoRepository {
  get(orgId: string, name: string): Promise<Ngo | null>;
  list(orgId: string): Promise<Ngo[]>;
  upsert(ngo: Ngo): Promise<Ngo>;
  /** Human action only — never expose this to a tool. */
  markVerified(orgId: string, name: string, regs: { reg80g?: string; reg12a?: string }): Promise<Ngo | null>;
}

const key = (orgId: string, name: string) => `${orgId}::${name.trim().toLowerCase()}`;

class InMemoryNgoRepository implements NgoRepository {
  private ngos = new Map<string, Ngo>();

  async get(orgId: string, name: string): Promise<Ngo | null> {
    return this.ngos.get(key(orgId, name)) ?? null;
  }

  async list(orgId: string): Promise<Ngo[]> {
    return [...this.ngos.values()].filter((n) => n.orgId === orgId);
  }

  async upsert(ngo: Ngo): Promise<Ngo> {
    const existing = this.ngos.get(key(ngo.orgId, ngo.name));
    // Re-registering must not silently re-verify. Verification only ever comes
    // from markVerified().
    const next: Ngo = { ...ngo, verified: existing?.verified ?? false, verifiedAt: existing?.verifiedAt };
    this.ngos.set(key(ngo.orgId, ngo.name), next);
    return next;
  }

  async markVerified(
    orgId: string,
    name: string,
    regs: { reg80g?: string; reg12a?: string }
  ): Promise<Ngo | null> {
    const existing = this.ngos.get(key(orgId, name));
    const next: Ngo = {
      ...(existing ?? { orgId, name }),
      reg80g: regs.reg80g ?? existing?.reg80g,
      reg12a: regs.reg12a ?? existing?.reg12a,
      verified: true,
      verifiedAt: Date.now(),
    };
    this.ngos.set(key(orgId, name), next);
    return next;
  }
}

const globalForNgo = globalThis as unknown as { __glNgoRepo?: NgoRepository };

export const ngos: NgoRepository = globalForNgo.__glNgoRepo ?? new InMemoryNgoRepository();
if (process.env.NODE_ENV !== "production") globalForNgo.__glNgoRepo = ngos;
