# ⚡ Second Helping

> Submission to **Swiggy Builders Club** — `mcp.swiggy.com/builders/`

**Programmatic CSR on Swiggy's rails. Cancelled orders rescued. Restaurants paid. NGOs fed. Corporates compliant.**

## What we're actually building (the full vision)

Every Indian company above ₹5Cr profit is **legally required** to spend 2% of net profit on CSR (Companies Act §135) — ₹25,000+ Cr/year of mandatory deployment. Today most of it goes to NGOs through manual POs, quarterly cheques, and spreadsheet impact reports. Meanwhile, Swiggy's last-mile network is moving cooked food across every major Indian city, and a non-trivial fraction of those orders get cancelled or fail post-prep — late customer cancellations, address issues, payment failures, restaurant unavailability. The food is already cooked. Most of it ends up wasted at the restaurant, and the restaurant absorbs the loss.

**Second Helping connects those two problems.**

A corporate CSR head sets up a standing program in Slack — *"₹40k/month, mixed shelters across Bangalore, veg only"*. From then on:

1. **Rescue lane (the main idea):** When a partner restaurant's Food order cancels or fails post-prep, our agent matches the in-flight order to the nearest verified NGO/shelter with capacity, debits the corporate's CSR budget for the order value, and reroutes the Bolt/Genie rider to the shelter instead of letting the food go to waste. The restaurant gets paid in full. The NGO gets a hot meal in 15 minutes. The corporate's CSR auto-deploys.
2. **Procurement lane (the subset we can ship today):** For predictable program needs — weekly bulk staples, daily cooked meals, festival community dinners — the agent runs recurring procurement across Instamart, Food, and Dineout. With 80G receipts and ESG dashboards generated automatically.

Why this is *Swiggy-shaped* and not a generic startup pitch:

- **Restaurant retention lever** — partners stop swallowing cancellation losses. Measurable.
- **Real ESG numbers** — Swiggy gets auditable "meals rescued from waste" stats, not marketing copy.
- **Zero marginal cost on rescue** — rider already dispatched, food already cooked, corporate budget already committed. Pure margin.
- **Only Swiggy can build this.** It needs control of the order lifecycle *and* the last mile. No third party (us included) could replicate it without those primitives.

## What we're shipping in v1 (the subset that runs on today's MCPs)

The cancellation/redirect APIs we need for the rescue lane don't exist on the MCPs today. We didn't want to fake them in the demo. So v1 ships only the **procurement lane** — which is real, useful on day one, and works fully on today's Food / Instamart / Dineout MCPs:

A CFO types in Slack: *"Sponsor 500 meals/week for Asha Kiran shelter, ₹40k/month, veg, nut-free."* The agent proposes a split (~70% Instamart bulk staples, ~30% Food partner-kitchen meals, with Dineout community tables on festival weeks), the user confirms, and it runs weekly from there. 80G receipt generates automatically; ESG dashboard updates live.

That's the demo in this repo. Full v2 spec is in [`PROMPT.md`](./PROMPT.md).

## What we'd need from Swiggy to ship v2 (the rescue lane)

Two new bits of MCP surface:

- **Webhook:** `food.order.cancelled` / `food.order.failed_post_prep` — fires with order items, restaurant location, estimated value, time-since-prep.
- **Method:** `food.delivery.redirect(order_id, new_drop_address, reason)` — reroute an in-flight delivery to an alternate verified address.

Plus an opt-in flag for partner restaurants (probably already exists internally) and standard rate-limiting on the redirect call. We're happy to design with the team.

If the Builders Club team is open to co-designing these endpoints, we'd love to be the first integration partner. If not, no hard feelings — v1 still solves a real problem on today's APIs.

## Architecture

```
CSR admin (Slack)
   │
   └─→ Second Helping agent (OpenAI gpt-5-mini · medium reasoning)
          │ tool-use loop
          ├─→ Swiggy Food MCP        (today: partner kitchens · v2: cancellation webhook + redirect)
          ├─→ Swiggy Instamart MCP   (bulk staples)
          ├─→ Swiggy Dineout MCP     (community tables)
          └─→ Our compliance layer   (NGO registry · 80G receipts · ESG dashboard)
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
PROMPT.md               → full v2 spec, including rescue-lane architecture
```

## Built with

- OpenAI `gpt-5-mini` with `reasoning_effort: "medium"` (`openai` SDK)
- Next.js 15 + React 19 + TypeScript
- Mock Swiggy MCP clients (Food, Instamart, Dineout) + internal compliance layer
