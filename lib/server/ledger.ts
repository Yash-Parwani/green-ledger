// The append-only ledger. Every rupee committed or spent, every policy
// refusal, every approval, every generated document — with the actor, the tool
// call that caused it, and a timestamp.
//
// APPEND-ONLY IS NOT A CONVENTION HERE, IT IS THE INTERFACE. LedgerRepository
// exposes append() and reads. There is no update() and no delete(). A mistake
// is corrected by appending a `correction` entry that points at the entry it
// corrects — the original stays. If you ever find yourself wanting to mutate a
// row, that instinct is the bug: an auditor's whole question is "can this have
// been edited after the fact", and the answer has to be structurally no.
//
// Entries carry a per-org monotonic `seq` so gaps are detectable. When this
// moves to Postgres: seq unique per org, no UPDATE/DELETE grant on the table.

import crypto from "node:crypto";
import type { Role } from "@/lib/server/session";

export type LedgerEntryKind =
  | "commitment" // money promised — a program registered, a recurring cart built
  | "spend" // money actually moved
  | "approval" // a human approved a proposal
  | "policy_refusal" // the policy engine blocked a tool call
  | "document" // an 80G receipt or GST invoice was generated
  | "correction"; // supersedes an earlier entry; never deletes it

export type LedgerActor = {
  userId: string;
  role: Role;
  /** Which agent proposed this, once Part 3 splits them. */
  agent?: string;
};

export type LedgerEntry = {
  id: string;
  orgId: string;
  seq: number;
  at: number;
  kind: LedgerEntryKind;
  /** Positive = committed/spent. Null for entries that move no money. */
  amountInr: number | null;
  actor: LedgerActor;
  toolName: string;
  /** The arguments the agent actually used. This is the "why money moved" record. */
  toolInput: unknown;
  summary: string;
  programId?: string;
  ngoName?: string;
  /** Reference to a stored 80G receipt / GST invoice. */
  artifactRef?: string;
  /** Set on `correction` entries — the entry this supersedes. */
  correctsEntryId?: string;
  /** Set on `policy_refusal` entries. */
  policyCode?: string;
};

export type LedgerAppend = Omit<LedgerEntry, "id" | "seq" | "at">;

export interface LedgerRepository {
  append(entry: LedgerAppend): Promise<LedgerEntry>;
  list(orgId: string, opts?: { limit?: number }): Promise<LedgerEntry[]>;
  /** Total committed + spent for an org, used by the budget ceiling rule. */
  totalCommittedInr(orgId: string): Promise<number>;
  /** Committed + spent since `since` (epoch ms), used by the per-day cap. */
  committedSinceInr(orgId: string, since: number): Promise<number>;
}

const MONEY_KINDS: LedgerEntryKind[] = ["commitment", "spend"];

class InMemoryLedgerRepository implements LedgerRepository {
  private entries: LedgerEntry[] = [];
  private seqByOrg = new Map<string, number>();

  async append(entry: LedgerAppend): Promise<LedgerEntry> {
    const seq = (this.seqByOrg.get(entry.orgId) ?? 0) + 1;
    this.seqByOrg.set(entry.orgId, seq);
    const full: LedgerEntry = {
      ...entry,
      id: `led_${crypto.randomBytes(9).toString("base64url")}`,
      seq,
      at: Date.now(),
    };
    this.entries.push(full);
    return full;
  }

  async list(orgId: string, opts: { limit?: number } = {}): Promise<LedgerEntry[]> {
    const rows = this.entries.filter((e) => e.orgId === orgId).sort((a, b) => b.seq - a.seq);
    return opts.limit ? rows.slice(0, opts.limit) : rows;
  }

  async totalCommittedInr(orgId: string): Promise<number> {
    return this.sum(this.entries.filter((e) => e.orgId === orgId));
  }

  async committedSinceInr(orgId: string, since: number): Promise<number> {
    return this.sum(this.entries.filter((e) => e.orgId === orgId && e.at >= since));
  }

  private sum(rows: LedgerEntry[]): number {
    return rows
      .filter((e) => MONEY_KINDS.includes(e.kind))
      .reduce((total, e) => total + (e.amountInr ?? 0), 0);
  }
}

const globalForLedger = globalThis as unknown as { __glLedgerRepo?: LedgerRepository };

export const ledger: LedgerRepository =
  globalForLedger.__glLedgerRepo ?? new InMemoryLedgerRepository();
if (process.env.NODE_ENV !== "production") globalForLedger.__glLedgerRepo = ledger;
