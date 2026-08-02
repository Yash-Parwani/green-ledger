import { tools, systemPrompt } from "@/lib/second-helping/tools";
import { createToolImpls } from "@/lib/second-helping/tool-impls";
import { runAgentLoop, type ClientMessage } from "@/lib/shared/agent-loop";
import { repo } from "@/lib/server/orgStore";
import { getSession, toAgentContext } from "@/lib/server/session";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  // Only `messages` is read from the body. The organization — and critically
  // its budget — comes from the signed session and the server-side store.
  // This route previously accepted a `corporateProfile` containing the org id,
  // name and annual budget straight off the wire, which meant any caller could
  // address another tenant or declare their own budget. Don't reintroduce it.
  const { messages }: { messages: ClientMessage[] } = await req.json();

  const session = await getSession();
  const ctx = session ? toAgentContext(session) : null;

  let effectiveSystemPrompt = systemPrompt;

  const org = ctx ? await repo.get(ctx.orgId) : null;
  if (org) {
    effectiveSystemPrompt +=
      `\n\n## This session's registered organization\n` +
      `Name: ${org.name}\n` +
      `Annual CSR budget: ₹${org.budgetTotalInr.toLocaleString("en-IN")}\n` +
      `Fiscal year end: ${org.fiscalYearEnd}\n` +
      `The profile is already registered — don't ask for it again or call setup_csr_profile ` +
      `unless the user explicitly wants to change the name or budget. Budget and scheduling ` +
      `tools act on this organization automatically and take no organization parameter.`;
  } else {
    effectiveSystemPrompt +=
      `\n\n## No CSR profile registered in this session\n` +
      `Budget and scheduling tools will refuse until one exists. You can still answer scoped ` +
      `questions (sourcing, kitchens, coupons). If the user wants budget or program work, ask ` +
      `for the corporate's name and annual CSR budget and call setup_csr_profile.`;
  }

  const result = await runAgentLoop({
    messages,
    systemPrompt: effectiveSystemPrompt,
    tools,
    toolImpls: createToolImpls(ctx) as never,
  });
  return Response.json(result);
}
