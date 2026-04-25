# Build Prompt — The Group Concierge

> Use this prompt to regenerate or extend the demo. Hand it to Claude Code, Cursor, or another LLM-coding agent as the spec.

## What we're building

**The Group Concierge** is an AI agent that takes a single natural-language brief from an event host (housewarming, kitty party, society potluck, birthday) and orchestrates the entire event across all three Swiggy Builders Club MCP servers — **Food**, **Instamart**, and **Dineout** — in one conversation.

Today the user bounces across 3 apps and a WhatsApp group. We collapse that into one chat: *"25-person housewarming, Bandra, next Saturday, ₹20k, mixed veg/non-veg"* → agent proposes a plan → user confirms → agent books venue + places split Food order + delivers Instamart supplies, all coordinated to land at the venue at 7pm.

## Why it wins

1. **Uses all 3 MCPs naturally**, not forced.
2. **Real moat: orchestration + aggregation logistics.** No single Swiggy surface solves "plan an event" today.
3. **Demoable in a week** with mock MCP clients; swap to real MCPs once Swiggy grants access.
4. **Expansion path:** consumers (groups/societies) → B2B (event planners, co-working spaces, builders' community apps).

## Tech stack

- **Next.js 15 (App Router) + React 19 + TypeScript**
- **Anthropic SDK** (`@anthropic-ai/sdk`) — model: `claude-opus-4-7`, manual tool-use loop for visibility into MCP calls
- **Mock MCP clients** in `lib/mock-mcp.ts` — each function mirrors the expected real MCP tool surface and returns deterministic fake data. Swap bodies for real `@modelcontextprotocol/sdk` calls when access is granted.

## Architecture

```
User → /app/page.tsx (chat UI)
     → POST /app/api/chat/route.ts
        → Anthropic Messages API with tools[] (Food/Instamart/Dineout schemas)
        → loop: model proposes tool_use → server runs mock MCP → feeds result back
        → final text + full trajectory returned to UI
     → UI renders chat reply + live MCP-call timeline (right pane)
```

## Tools the agent has

| Tool | MCP | Purpose |
|------|-----|---------|
| `dineout_search_restaurants` | Dineout | Find venues that can host the party |
| `dineout_reserve` | Dineout | Book a slot |
| `food_search_restaurants` | Food | Find delivery options for catering / overflow |
| `food_create_group_order` | Food | Place a group order with auto-split UPI collect |
| `instamart_search` | Instamart | Find decor, drinks, ice, disposables |
| `instamart_add_to_cart` | Instamart | Schedule supply delivery to venue |

## Agent behavior

- **Clarify only what's blocking** — date, headcount, budget, location, dietary mix.
- **Propose a plan before booking** — show intent + rough costs across all three surfaces.
- **Coordinate timing** — Food + Instamart should land at venue arrival, not before.
- **Keep responses tight** — phone-friendly markdown, no walls of text.

## Demo script (90s Loom)

1. **Hook (10s):** split screen — WhatsApp group with 40 unread messages on the left, our chat on the right.
2. **Brief (15s):** type the example prompt; agent asks one clarifying question.
3. **Plan (20s):** agent returns a structured plan with venue, food, supplies, totals.
4. **Money shot (30s):** confirm; show the **right-pane MCP-call timeline** lighting up — `dineout_search → dineout_reserve → food_search → food_create_group_order → instamart_search → instamart_add_to_cart`.
5. **Result (15s):** agent returns reservation IDs, order IDs, UPI-collect-sent count, ETAs.

## To run locally

```bash
cp .env.example .env
# add ANTHROPIC_API_KEY
npm install
npm run dev
```

## To swap mock MCPs for real Swiggy MCPs

Each function in `lib/mock-mcp.ts` has an obvious `await delay(); return { ok: true, data: ... }` body. Replace with the real MCP client call from `mcp.swiggy.com/builders/`:

```ts
// before (mock)
export async function food_search_restaurants(input) {
  await delay();
  return { ok: true, data: { results: [...] } };
}

// after (real MCP)
import { swiggyFoodClient } from "@/lib/swiggy-mcp";
export async function food_search_restaurants(input) {
  return swiggyFoodClient.callTool("search_restaurants", input);
}
```

OAuth redirect URI for the Swiggy form: `https://groupconcierge.app/oauth/swiggy/callback` (prod), `http://localhost:3000/oauth/swiggy/callback` (dev).
