# ⚡ Second Helping

> Submission to **Swiggy Builders Club** — `mcp.swiggy.com/builders/`

**Programmatic CSR on Swiggy rails. Slack in, 80G receipt out.**

Every Indian company with ≥₹5Cr profit is **legally required** to spend 2% of net profit on CSR (Companies Act §135). That's ₹25,000+ Cr/year of mandatory deployment, mostly handled today by spreadsheets, manual POs, and quarterly cheques to NGOs.

Second Helping turns that into one Slack thread. A CFO types *"Sponsor 500 meals/week for Asha Kiran shelter, ₹40k/month, veg, nut-free"* — and the agent autonomously runs the full program every week across **Swiggy Instamart** (bulk staples), **Swiggy Food** (FSSAI partner kitchens), and **Swiggy Dineout** (community tables for festivals), with auto-generated **80G receipts** and **ESG dashboards** on day one.

## The category bet

- **Give.do & Ketto** won donation-tech.
- **Nobody** has won programmatic CSR *procurement* — the part where money turns into actual goods and services delivered to beneficiaries.
- Swiggy is the only operator with urban last-mile dense enough to make this real.

This isn't a consumer feature. It's a new **B2B GMV channel** with corporate ACVs that dwarf consumer unit economics.

## Architecture

```
CSR admin (Slack)
   │
   └─→ Second Helping agent (OpenAI gpt-5-mini · medium reasoning)
          │ tool-use loop
          ├─→ Swiggy Instamart MCP   (bulk staples)
          ├─→ Swiggy Food MCP        (partner kitchens)
          ├─→ Swiggy Dineout MCP     (community tables)
          └─→ Our compliance layer   (80G receipts + ESG dashboard)
```

## Run it

```bash
cp .env.example .env   # add OPENAI_API_KEY
npm install
npm run dev            # http://localhost:3001
```

## Project layout

```
app/
  page.tsx              → Slack-style UI + impact dashboard
  api/chat/route.ts     → agent loop (OpenAI SDK + 7 tools)
lib/
  tools.ts              → MCP + compliance tool schemas + system prompt
  mock-mcp.ts           → mock MCP + compliance implementations
PROMPT.md               → full build spec
```

## On the MCP gap

Today's MCPs support the procurement path end-to-end (search → cart → recurring orders + reservations). The v1 demo runs entirely on what's exposed today.

## The bigger vision: cancelled-order rescue (needs new MCP surface)

Here's the part we couldn't build with today's APIs but think is worth flagging — because if Swiggy builds it, *this is the thing*.

Every day, a non-trivial chunk of Swiggy Food orders get cancelled or fail post-prep — customer cancels late, restaurant marks unavailable, address issue, payment fails after the food is already cooked. The food exists, it's hot, and right now most of it ends up wasted at the restaurant.

What we'd build with the right hooks:

1. **A webhook from Food MCP that fires on cancellation/failure** with the order details (items, restaurant location, estimated value).
2. **A "redirect delivery" call** that lets us reroute the order to a different drop address.

Then Second Helping does this:

- Subscribes to those events for partner restaurants (with their consent, since they get paid either way).
- Maintains a verified NGO/shelter registry geo-indexed by neighbourhood.
- When a cancellation fires, the agent matches the order to the nearest NGO with capacity within delivery radius, debits the corporate's standing CSR budget for the order value, and reroutes the Bolt/Genie rider to drop it there instead of the restaurant eating the loss.

Why this is interesting for Swiggy specifically:

- **Restaurant retention** — partner restaurants stop swallowing cancellation losses, get paid in full. This is a measurable retention lever.
- **Sustainability story** — Swiggy gets a real, audited "meals rescued from waste" number for ESG reporting, not a marketing claim.
- **CSR money flows in at zero marginal logistics cost** — the rider is already dispatched, the food is already cooked, the corporate's budget is already committed.
- **Nobody else can build this.** It only works if you control the order lifecycle and the last mile. Swiggy is uniquely positioned.

We can't ship this in v1 because it needs MCP surface that doesn't exist today (cancellation webhooks + delivery redirect). But if the Builders Club team is interested in co-designing those endpoints, we'd love to be the first integration partner — and we think the unit economics are strong enough that it'd pay for the API work several times over.

In the meantime, we're shipping the procurement use case (above) which works on today's MCPs.

## Built with

- OpenAI `gpt-5-mini` with `reasoning_effort: "medium"` (`openai` SDK)
- Next.js 15 + React 19 + TypeScript
- Mock Swiggy MCP clients (Food, Instamart, Dineout) + internal compliance layer
