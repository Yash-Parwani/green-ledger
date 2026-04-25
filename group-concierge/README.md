# 🍱 The Group Concierge

> Submission to **Swiggy Builders Club** — `mcp.swiggy.com/builders/`

**One brief. One agent. Your entire event planned across Swiggy.**

The Group Concierge is an AI agent that turns a single natural-language brief — *"Planning a 25-person housewarming in Bandra next Saturday, ₹20k budget, mixed veg/non-veg"* — into a fully coordinated event across Swiggy's stack. It aggregates individual preferences, books the venue via **Dineout**, places split **Food** orders with a single consolidated drop, and handles decor/drinks/ice through **Instamart**. One conversation replaces 3 apps and 40 WhatsApp messages.

## The problem

Today the "group event" use case scatters Swiggy GMV across 3 surfaces with high drop-off between them. A host opens Dineout to book a venue, switches to Food to figure out catering, jumps to Instamart for ice and decor, and then runs a WhatsApp poll to collect preferences and money. Most events never make it past step two.

## The wedge

A Group Concierge agent that sits on top of all three MCPs and orchestrates the event end-to-end. The agent:

- **Aggregates preferences** from the host's brief (and optionally a poll link sent to guests)
- **Reasons across surfaces** — when does the venue need to be booked, what's the catering overflow, what supplies arrive at venue arrival
- **Splits payment** automatically via UPI collect to every guest
- **Coordinates timing** so Food and Instamart land at the venue together, not in three separate trips

## Why this wins for Swiggy

- Collapses the cross-surface drop-off funnel into one conversation
- Increases per-event basket size by making cross-surface ordering frictionless
- Opens a B2B expansion lane: event planners, co-working spaces, housing-society apps

## Architecture

```
Next.js (App Router) ─→ /api/chat ─→ OpenAI gpt-5-mini (medium reasoning)
                                    │ tool-use loop
                                    ├─→ Swiggy Food MCP
                                    ├─→ Swiggy Instamart MCP
                                    └─→ Swiggy Dineout MCP
```

The demo ships with **mock MCP clients** in `lib/mock-mcp.ts` that mirror the expected Swiggy MCP surface. Swap to real MCPs once access is granted.

## Run it

```bash
cp .env.example .env   # add OPENAI_API_KEY
npm install
npm run dev
```

Open http://localhost:3000.

## Project layout

```
app/
  page.tsx              → chat UI + live MCP call timeline
  api/chat/route.ts     → agent loop (Anthropic SDK + tools)
lib/
  tools.ts              → MCP tool schemas + system prompt
  mock-mcp.ts           → mock implementations (swap for real MCPs)
PROMPT.md               → full build spec
```

## Built with

- OpenAI `gpt-5-mini` with `reasoning_effort: "medium"` (`openai` SDK)
- Next.js 15 + React 19 + TypeScript
- Mock Swiggy MCP clients (Food, Instamart, Dineout)
