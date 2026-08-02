import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 30;

const client = new Anthropic();

const INSTRUCTION =
  "You are reading a screenshot of a chat thread or a budget spreadsheet related to an organizational or CSR-funded program — " +
  "a society/RWA event, a company offsite, an NGO meal program, or a corporate CSR budget. This is pooled or organizational " +
  "spend, never a personal expense. Extract the key facts (headcount, budget, location, date, dietary mix, or program specifics) " +
  "and rewrite them as ONE tight natural-language brief a user could type into a chat box, e.g. 'Whitefield RWA Diwali potluck " +
  "for 60 households, ₹85k pooled budget, this Saturday' or 'CSR budget: ₹12L left this quarter, set up a recurring meal program'. " +
  "Return only the sentence, no preamble.";

const SUPPORTED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (!SUPPORTED_MEDIA_TYPES.has(file.type)) {
    return Response.json(
      { error: "Only image uploads (e.g. a screenshot) are supported in this demo." },
      { status: 400 }
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 256,
    output_config: { effort: "low" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: bytes.toString("base64") },
          },
          { type: "text", text: INSTRUCTION },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text.trim() : "";
  return Response.json({ text });
}
