import { tools, systemPrompt } from "@/lib/group-concierge/tools";
import { createToolImpls } from "@/lib/group-concierge/tool-impls";
import { runAgentLoop, type ClientMessage } from "@/lib/shared/agent-loop";
import { repo } from "@/lib/server/orgStore";
import { getSession, toAgentContext } from "@/lib/server/session";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages }: { messages: ClientMessage[] } = await req.json();

  // Same session and the same policy engine as the CSR console. This route
  // previously ran completely ungated — no session, no policy, no ledger —
  // while holding the order-placing and table-booking tools.
  const session = await getSession();
  const ctx = session ? toAgentContext(session) : null;

  let effectiveSystemPrompt = systemPrompt;
  const org = ctx ? await repo.get(ctx.orgId) : null;

  effectiveSystemPrompt += org
    ? `\n\n## This session's registered organization\n` +
      `Name: ${org.name}\n` +
      `Orders and reservations are committed on behalf of this organization and are subject ` +
      `to the same approval and audit controls as CSR spend.`
    : `\n\n## No organization registered in this session\n` +
      `Ordering and reservation tools will be refused by policy until an organization is ` +
      `registered in the console. Search and planning still work — use them to build a ` +
      `costed proposal the user can take to approval.`;

  const result = await runAgentLoop({
    messages,
    systemPrompt: effectiveSystemPrompt,
    tools,
    toolImpls: createToolImpls(ctx) as never,
  });
  return Response.json(result);
}
