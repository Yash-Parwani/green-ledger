import Anthropic from "@anthropic-ai/sdk";

export type ClientMessage = { role: "user" | "assistant"; content: string };
export type TrajEntry =
  | { kind: "text"; text: string }
  | { kind: "tool_use"; name: string; input: unknown; id: string }
  | { kind: "tool_result"; id: string; output: unknown };

export type AnthropicTool = { name: string; description: string; input_schema: Anthropic.Tool.InputSchema };

const client = new Anthropic();

export async function runAgentLoop(opts: {
  messages: ClientMessage[];
  systemPrompt: string;
  tools: AnthropicTool[];
  toolImpls: Record<string, (input: never) => Promise<unknown>>;
  maxSteps?: number;
}): Promise<{ reply: string; trajectory: TrajEntry[] }> {
  const { messages, systemPrompt, tools, toolImpls, maxSteps = 10 } = opts;

  const convo: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const trajectory: TrajEntry[] = [];

  for (let step = 0; step < maxSteps; step++) {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 4096,
      system: systemPrompt,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      tools,
      messages: convo,
    });

    const textParts: string[] = [];
    for (const block of response.content) {
      if (block.type === "text") {
        textParts.push(block.text);
        trajectory.push({ kind: "text", text: block.text });
      } else if (block.type === "tool_use") {
        trajectory.push({ kind: "tool_use", name: block.name, input: block.input, id: block.id });
      }
    }

    if (response.stop_reason !== "tool_use") {
      return { reply: textParts.join("\n"), trajectory };
    }

    convo.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const impl = toolImpls[block.name];
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

  return { reply: "[agent stopped after max steps]", trajectory };
}
