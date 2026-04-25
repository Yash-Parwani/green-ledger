import Anthropic from "@anthropic-ai/sdk";
import { tools, systemPrompt } from "@/lib/tools";
import { toolImpls, type ToolName } from "@/lib/mock-mcp";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic();

type ClientMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const { messages }: { messages: ClientMessage[] } = await req.json();

  const convo: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const trajectory: Array<
    | { kind: "tool_use"; name: string; input: unknown; id: string }
    | { kind: "tool_result"; id: string; output: unknown }
  > = [];

  for (let step = 0; step < 12; step++) {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages: convo,
    });

    for (const block of response.content) {
      if (block.type === "tool_use")
        trajectory.push({ kind: "tool_use", name: block.name, input: block.input, id: block.id });
    }

    if (response.stop_reason !== "tool_use") {
      const finalText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n\n");
      return Response.json({ reply: finalText, trajectory });
    }

    convo.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const impl = toolImpls[block.name as ToolName];
      const result = impl
        ? await impl(block.input as never)
        : { ok: false, error: `Unknown tool ${block.name}` };
      trajectory.push({ kind: "tool_result", id: block.id, output: result });
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }
    convo.push({ role: "user", content: toolResults });
  }

  return Response.json({ reply: "[agent stopped after 12 steps]", trajectory });
}
