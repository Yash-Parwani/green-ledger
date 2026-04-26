import OpenAI from "openai";
import { tools, systemPrompt } from "@/lib/tools";
import { toolImpls, type ToolName } from "@/lib/mock-mcp";
import dotenv from "dotenv";
dotenv.config();
export const runtime = "nodejs";
export const maxDuration = 60;

const baseUrl = process.env.OPENAI_URL ;
const subscriptionKey = process.env.OPENAI_API_KEY ;
const client = new OpenAI({
  baseURL: baseUrl,
  apiKey: subscriptionKey,
});

type ClientMessage = { role: "user" | "assistant"; content: string };
type TrajEntry =
  | { kind: "tool_use"; name: string; input: unknown; id: string }
  | { kind: "tool_result"; id: string; output: unknown };

export async function POST(req: Request) {
  const { messages }: { messages: ClientMessage[] } = await req.json();

  const convo: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages.map<OpenAI.Chat.ChatCompletionMessageParam>((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  const trajectory: TrajEntry[] = [];

  for (let step = 0; step < 12; step++) {
    const response = await client.chat.completions.create({
      model: "gpt-5-mini",
      reasoning_effort: "medium",
      tools,
      messages: convo,
    });

    const msg = response.choices[0].message;

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      for (const tc of msg.tool_calls) {
        if (tc.type !== "function") continue;
        let parsed: unknown = {};
        try { parsed = JSON.parse(tc.function.arguments); } catch { /* */ }
        trajectory.push({ kind: "tool_use", name: tc.function.name, input: parsed, id: tc.id });
      }
    }

    if (response.choices[0].finish_reason !== "tool_calls" || !msg.tool_calls) {
      return Response.json({ reply: msg.content ?? "", trajectory });
    }

    convo.push(msg);

    for (const tc of msg.tool_calls) {
      if (tc.type !== "function") continue;
      const impl = toolImpls[tc.function.name as ToolName];
      let args: unknown = {};
      try { args = JSON.parse(tc.function.arguments); } catch { /* */ }
      const result = impl
        ? await impl(args as never)
        : { ok: false, error: `Unknown tool ${tc.function.name}` };
      trajectory.push({ kind: "tool_result", id: tc.id, output: result });
      convo.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }
  }

  return Response.json({ reply: "[agent stopped after 12 steps]", trajectory });
}
