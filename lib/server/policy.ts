// The policy engine. It sits between the agent and every tool call and can
// hard-refuse.
//
// The property this exists to provide:
//
//   The agent cannot spend money incorrectly even if the prompt is compromised
//   or the model misbehaves.
//
// Which means none of these rules may be expressed as prompt text. Prompt text
// is advisory; a model can be argued out of it, and a prompt-injected document
// can overwrite it. Everything here runs in code the model cannot reach, after
// the model has chosen its arguments and before the tool runs.
//
// Refusals are STRUCTURED, not thrown. The agent receives a machine-readable
// code plus a remedy so it can explain the block to the user and do the right
// next thing — usually "ask for approval" — rather than retrying blindly.

import { repo } from "@/lib/server/orgStore";
import { ledger } from "@/lib/server/ledger";
import { ngos } from "@/lib/server/ngoStore";
import { proposals, callHashOf } from "@/lib/server/proposals";
import type { AgentContext, Role } from "@/lib/server/session";

// ─── Tunables ─────────────────────────────────────────────────────────────────
// Per-org configuration once Organization is durable; constants for now.

export const POLICY_LIMITS = {
  /** Commitments may not push utilization past this without escalation. */
  utilizationCeilingPct: 90,
  /** Any single commitment above this needs approval regardless of other rules. */
  perRunCapInr: 500_000,
  /** Rolling 24h ceiling on total commitments. */
  perDayCapInr: 2_000_000,
};

const ROLES_THAT_MAY_COMMIT: Role[] = ["csr_admin", "approver"];

// ─── Tool classification ──────────────────────────────────────────────────────
// A tool is gated by what it DOES, declared here, not by what the agent says it
// is doing. Anything absent from this map is treated as read-only.
//
// Adding an order-placing tool without adding it here is the failure mode that
// let `instamart_add_to_cart` call a live checkout. If you add a tool that
// moves money, add it here in the same commit.

type Committing = {
  /** Pull the committed amount from the tool input, if it's knowable up front. */
  amountInr?: (input: Record<string, unknown>) => number | null;
  ngoName?: (input: Record<string, unknown>) => string | undefined;
  describe: (input: Record<string, unknown>) => string;
};

const COMMITTING_TOOLS: Record<string, Committing> = {
  schedule_program: {
    amountInr: (i) => (typeof i.total_budget_inr === "number" ? i.total_budget_inr : null),
    ngoName: (i) => (typeof i.ngo_name === "string" ? i.ngo_name : undefined),
    describe: (i) =>
      `Register program "${i.program_name}" for ${i.ngo_name} — ₹${Number(
        i.total_budget_inr ?? 0
      ).toLocaleString("en-IN")}, ${i.cadence}`,
  },
  // These build a real cart at live prices, so the final total isn't knowable
  // from the input alone. But the agent has usually already priced it with
  // food_menu_quote / instamart_search_bulk, so it passes that figure through
  // as `estimated_total_inr` and the commitment bands like any other.
  //
  // Without this the priced figure had nowhere to go: every cooked-meal
  // programme escalated as "amount unknown" even when the agent had just
  // quoted it to the rupee. Read the estimate here, and keep it a real number
  // the approver sees — an approval that says "amount set at execution" is an
  // approval of nothing.
  instamart_schedule_recurring: {
    amountInr: estimatedTotal,
    ngoName: (i) => (typeof i.ngo_name === "string" ? i.ngo_name : undefined),
    describe: (i) =>
      `Recurring Instamart staples for ${i.ngo_name} — ${i.cadence}, ${plural(i.weeks, "week")}`,
  },
  food_schedule_meal_program: {
    amountInr: estimatedTotal,
    ngoName: (i) => (typeof i.ngo_name === "string" ? i.ngo_name : undefined),
    describe: (i) =>
      `Recurring Food meal program for ${i.ngo_name} — ${i.servings_per_drop} servings, ${i.cadence}, ${plural(i.weeks, "week")}`,
  },
  dineout_community_table: {
    amountInr: estimatedTotal,
    describe: (i) => `Dineout community table — party of ${i.party_size} on ${i.date}, ${i.location}`,
  },

  // ── The Group Concierge ────────────────────────────────────────────────────
  // Same engine, same gate. These were completely ungated until now, which
  // meant flipping the console's mode switch stepped around every control on
  // the CSR side — including for `instamart_add_to_cart`, the tool that once
  // called Instamart's real `checkout` with paymentMethod "Cash".
  food_create_group_order: {
    amountInr: estimatedTotal,
    describe: (i) =>
      `Group food order — ${(i.items as { name: string }[] | undefined)?.length ?? 0} dishes to ${
        i.delivery_address
      }, split among ${i.split_payment_among}`,
  },
  instamart_add_to_cart: {
    amountInr: estimatedTotal,
    describe: (i) =>
      `Instamart order — ${(i.items as unknown[] | undefined)?.length ?? 0} line items to ${i.delivery_address}`,
  },
  // No money moves (Swiggy restricts Dineout booking to free reservations), but
  // it creates a real booking at a real restaurant under someone's name. A
  // demo should not be able to do that by accident, so it needs approval too.
  dineout_reserve: {
    amountInr: () => null,
    describe: (i) =>
      `Dineout reservation — party of ${i.party_size} on ${i.date} at ${i.time}, host ${i.host_name}`,
  },
};

/** The agent's own priced figure, when it has one. Must be a positive finite
 *  number — a zero or a NaN would band as "cheap" and skip escalation. */
function estimatedTotal(i: Record<string, unknown>): number | null {
  const v = i.estimated_total_inr;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

function plural(n: unknown, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function isCommittingTool(name: string): boolean {
  return name in COMMITTING_TOOLS;
}

// ─── Decisions ────────────────────────────────────────────────────────────────

export type PolicyCode =
  | "NO_ORG"
  | "NO_PROFILE"
  | "ROLE_NOT_PERMITTED"
  | "NGO_UNVERIFIED"
  | "APPROVAL_REQUIRED"
  | "UTILIZATION_CEILING"
  | "PER_RUN_CAP"
  | "PER_DAY_CAP"
  | "BUDGET_EXCEEDED";

export type PolicyDecision =
  | { allow: true; proposalId?: string }
  | {
      allow: false;
      code: PolicyCode;
      reason: string;
      remedy: string;
      /** Set when the engine opened a proposal for a human to approve. */
      proposalId?: string;
    };

export type PolicyRefusalResult = {
  ok: false;
  error: string;
  policy: { code: PolicyCode; reason: string; remedy: string; proposal_id?: string };
};

// ─── Evaluation ───────────────────────────────────────────────────────────────

export async function evaluate(
  ctx: AgentContext | null,
  toolName: string,
  rawInput: unknown
): Promise<PolicyDecision> {
  const spec = COMMITTING_TOOLS[toolName];
  if (!spec) return { allow: true }; // read-only tools are unrestricted

  if (!ctx) {
    return {
      allow: false,
      code: "NO_ORG",
      reason: "No organization in this session.",
      remedy: "The user must register their organization in the console before committing spend.",
    };
  }

  const input = (rawInput ?? {}) as Record<string, unknown>;
  const org = await repo.get(ctx.orgId);
  if (!org) {
    return {
      allow: false,
      code: "NO_PROFILE",
      reason: "No CSR profile is registered for this organization.",
      remedy: "Call setup_csr_profile with the corporate's name and annual CSR budget first.",
    };
  }

  // 1. Role. A viewer or finance user cannot commit spend, whatever they ask for.
  if (!ROLES_THAT_MAY_COMMIT.includes(ctx.role)) {
    return {
      allow: false,
      code: "ROLE_NOT_PERMITTED",
      reason: `Role "${ctx.role}" may not commit CSR spend.`,
      remedy: "A csr_admin or approver must perform this action.",
    };
  }

  // 2. Donee verification. Fails closed: an NGO nobody registered is unverified,
  //    not merely unknown.
  //    Matching is exact (case/whitespace-insensitive) and stays that way —
  //    fuzzy matching on a control that gates money is how "Asha Kiran" gets
  //    paid against "Asha Kiran Foundation"'s verification. Instead of
  //    loosening the match, the refusal hands back the exact registered names
  //    so the agent can correct itself and retry precisely.
  const ngoName = spec.ngoName?.(input);
  if (ngoName) {
    const ngo = await ngos.get(ctx.orgId, ngoName);
    if (!ngo?.verified) {
      const verified = (await ngos.list(ctx.orgId)).filter((n) => n.verified).map((n) => n.name);
      const options = verified.length
        ? ` Verified donees for this organization are: ${verified
            .map((n) => `"${n}"`)
            .join(", ")}. If you meant one of these, retry using that exact name.`
        : " No donees have been verified for this organization yet.";
      return {
        allow: false,
        code: "NGO_UNVERIFIED",
        reason: ngo
          ? `${ngoName}'s 80G/12A registration has not been verified.`
          : `"${ngoName}" is not a verified beneficiary for this organization.`,
        remedy:
          "A human must verify the NGO's 80G/12A registration documents in the console before any spend is committed to them. You cannot verify it yourself." +
          options,
      };
    }
  }

  const amount = spec.amountInr?.(input) ?? null;

  // 3. Amount-based ceilings. Only checkable when the input carries a total.
  if (amount !== null) {
    if (amount <= 0) {
      return {
        allow: false,
        code: "PER_RUN_CAP",
        reason: "Commitment amount must be a positive number.",
        remedy: "Re-check the budget figure before proposing this again.",
      };
    }

    const alreadyCommitted = await ledger.totalCommittedInr(ctx.orgId);
    const projected = alreadyCommitted + amount;

    if (projected > org.budgetTotalInr) {
      return {
        allow: false,
        code: "BUDGET_EXCEEDED",
        reason: `This would commit ₹${projected.toLocaleString(
          "en-IN"
        )} against an annual CSR budget of ₹${org.budgetTotalInr.toLocaleString("en-IN")}.`,
        remedy:
          "Reduce the commitment to fit the remaining budget, or have the budget formally increased. Do not split it into smaller commitments to get under the limit.",
      };
    }

    const projectedPct = Math.round((projected / org.budgetTotalInr) * 100);
    if (projectedPct > POLICY_LIMITS.utilizationCeilingPct) {
      return {
        allow: false,
        code: "UTILIZATION_CEILING",
        reason: `This would take utilization to ${projectedPct}%, past the ${POLICY_LIMITS.utilizationCeilingPct}% ceiling.`,
        remedy:
          "Deploying the last of the budget needs explicit escalation to the CSR committee. Tell the user this needs sign-off above the usual approval, and what's left.",
      };
    }

    const since = Date.now() - 24 * 60 * 60 * 1000;
    const last24h = await ledger.committedSinceInr(ctx.orgId, since);
    if (last24h + amount > POLICY_LIMITS.perDayCapInr) {
      return {
        allow: false,
        code: "PER_DAY_CAP",
        reason: `₹${(last24h + amount).toLocaleString("en-IN")} committed in 24h exceeds the ₹${POLICY_LIMITS.perDayCapInr.toLocaleString("en-IN")} daily cap.`,
        remedy: "Schedule the remainder for a later day, or have the daily cap raised for this organization.",
      };
    }
  }

  // 4. Approval. Last check, so the proposal we open has already passed the
  //    others — there's no point asking a human to approve something the engine
  //    would refuse anyway.
  const hash = callHashOf(toolName, rawInput);
  const approved = await proposals.findApprovedByCallHash(ctx.orgId, hash);
  if (approved) return { allow: true, proposalId: approved.id };

  // Amount-banded second approver, DORMANT while the threshold is null — see
  // the note on Org.dualApprovalThresholdInr. With no way to actually reach a
  // second approver, escalating only dead-ends the flow. When the notification
  // channel lands, set a threshold and this comes back with no other change:
  // an unknown amount escalates too, because a cart whose total nobody knows
  // is exactly where a second pair of eyes is worth most.
  const threshold = org.dualApprovalThresholdInr;
  const requiresSecondApprover =
    threshold !== null && (amount === null || amount >= threshold);

  const proposal = await proposals.create({
    orgId: ctx.orgId,
    callHash: hash,
    toolName,
    toolInput: rawInput,
    amountInr: amount,
    ngoName,
    summary: spec.describe(input),
    requiresSecondApprover,
    proposedBy: ctx.userId,
    proposedByEmail: org.adminEmail,
    proposedByRole: ctx.role,
  });

  const thresholdLabel = threshold !== null ? `₹${threshold.toLocaleString("en-IN")}` : null;
  return {
    allow: false,
    code: "APPROVAL_REQUIRED",
    reason: `This commitment needs human approval before it can execute: ${proposal.summary}`,
    remedy: requiresSecondApprover
      ? `A proposal has been opened, and this one is above the ${thresholdLabel} second-approver threshold${
          amount === null ? " (its total isn't known yet, which escalates by default)" : ""
        } — so it must be approved by someone other than the CSR admin who proposed it. Tell the user that plainly, show them what needs approving, and note the approval is bound to these exact figures: changing any of them requires a fresh approval.`
      : `A proposal has been opened. The signed-in CSR admin can approve it themselves — the approve control is in the chat, right under this message, one click. Show them exactly what they're approving, and note the approval is bound to these exact figures: changing any of them requires a fresh approval.`,
    proposalId: proposal.id,
  };
}

/** Shape a refusal into the ToolResult the agent receives. */
export function toToolResult(d: Extract<PolicyDecision, { allow: false }>): PolicyRefusalResult {
  return {
    ok: false,
    error: `Blocked by CSR spending policy [${d.code}]: ${d.reason} ${d.remedy}`,
    policy: { code: d.code, reason: d.reason, remedy: d.remedy, proposal_id: d.proposalId },
  };
}
