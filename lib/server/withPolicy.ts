// Wraps a map of tool implementations so every call passes through the policy
// engine and lands in the ledger.
//
// This is deliberately a wrapper over the WHOLE map rather than something each
// tool opts into. Opt-in controls fail the same way every time: someone adds a
// tool, forgets the check, and the gap is invisible until it costs money. The
// Instamart `checkout` that sat live in this codebase behind nothing but a URL
// typo is exactly that failure.

import { evaluate, toToolResult, isCommittingTool } from "@/lib/server/policy";
import { ledger } from "@/lib/server/ledger";
import { proposals } from "@/lib/server/proposals";
import type { AgentContext } from "@/lib/server/session";

type Impl = (input: never) => Promise<unknown>;

export function withPolicy<T extends Record<string, Impl>>(
  ctx: AgentContext | null,
  impls: T
): T {
  const wrapped: Record<string, Impl> = {};

  for (const [name, impl] of Object.entries(impls)) {
    wrapped[name] = async (input: never) => {
      const decision = await evaluate(ctx, name, input);

      if (!decision.allow) {
        // Refusals are ledgered too. "The system refused to do this, here's
        // why" is audit evidence in its own right, and a refusal rate that
        // suddenly moves is the signal something upstream broke.
        if (ctx) {
          await ledger.append({
            orgId: ctx.orgId,
            kind: "policy_refusal",
            amountInr: null,
            actor: { userId: ctx.userId, role: ctx.role },
            toolName: name,
            toolInput: input,
            summary: decision.reason,
            policyCode: decision.code,
          });
        }
        return toToolResult(decision);
      }

      const result = await impl(input);

      // Only ledger a commitment if the tool actually succeeded — a failed
      // Swiggy call must not show up as money committed.
      const ok = (result as { ok?: boolean } | null)?.ok !== false;
      if (ctx && ok && isCommittingTool(name)) {
        const i = (input ?? {}) as Record<string, unknown>;
        const amount = typeof i.total_budget_inr === "number" ? i.total_budget_inr : null;
        await ledger.append({
          orgId: ctx.orgId,
          kind: "commitment",
          amountInr: amount,
          actor: { userId: ctx.userId, role: ctx.role },
          toolName: name,
          toolInput: input,
          summary:
            typeof i.program_name === "string"
              ? `Committed: ${i.program_name}`
              : `Committed via ${name}`,
          ngoName: typeof i.ngo_name === "string" ? i.ngo_name : undefined,
          programId:
            typeof (result as { data?: { program_id?: string } })?.data?.program_id === "string"
              ? (result as { data: { program_id: string } }).data.program_id
              : undefined,
        });

        if (decision.proposalId) await proposals.markExecuted(ctx.orgId, decision.proposalId);
      }

      return result;
    };
  }

  return wrapped as T;
}
