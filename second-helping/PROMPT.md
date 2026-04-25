# Build Prompt — Second Helping

> Use this prompt to regenerate or extend the demo. Hand it to Claude Code, Cursor, or another LLM-coding agent as the spec.

## What we're building

**Second Helping** is a Slack/Teams-native AI agent that lets Indian corporates put their **mandatory 2% CSR budget** (Companies Act §135) on autopilot. A CFO or CSR head describes intent in plain English — *"Sponsor 500 meals/week for Asha Kiran shelter, ₹40k/month, veg, nut-free"* — and the agent autonomously executes weekly procurement across all three Swiggy MCPs:

- **Instamart MCP** → bulk staples (rice, dal, oil) at wholesale prices
- **Food MCP** → cooked meals via FSSAI-certified partner kitchens
- **Dineout MCP** → community-table reservations at participating restaurants for festival meals

Plus an internal compliance layer (the part that's *our* product, not Swiggy's):

- 80G-compliant donation receipts (auto-generated PDFs)
- ESG impact dashboard (meals served, ₹/meal, CO₂ avoided, ESG score delta)
- Section 135 quarterly compliance reports

## Why this is the bold pitch

Give.do and Ketto won donation-tech. **No one has won programmatic CSR procurement** — the ₹25,000+ Cr/year that Indian corporates are legally obligated to deploy. Today they spend it via manual POs to NGOs, quarterly cheques, and spreadsheet impact reports. Swiggy is the only player with dense enough urban last-mile to make this real.

This isn't a feature. It's a new B2B GMV channel for Swiggy with ACVs that dwarf consumer unit economics.

## Tech stack

- **Next.js 15 (App Router) + React 19 + TypeScript**
- **Anthropic SDK** with `claude-opus-4-7`, manual tool-use loop
- **Slack-style UI** (channel list + chat + impact dashboard right pane) — matches the actual integration surface
- **Mock MCP clients** in `lib/mock-mcp.ts` — same swap-for-real pattern as Group Concierge

## Architecture

```
CSR admin → Slack #csr-procurement
         → Second Helping bot (Slack Bolt, swappable)
         → Anthropic agent loop with 7 tools:
             ├─ Instamart: search_bulk, schedule_recurring
             ├─ Food: partner_kitchens, schedule_meal_program
             ├─ Dineout: community_table
             └─ Our layer: generate_80g_receipt, impact_dashboard_update
         → returns plan; on approval, executes weekly cron
```

## Key tools

| Tool | MCP | Purpose |
|------|-----|---------|
| `instamart_search_bulk` | Instamart | Find best per-kg price for staples |
| `instamart_schedule_recurring` | Instamart | Set up biweekly bulk drops to NGO |
| `food_partner_kitchens` | Food | Find FSSAI-certified scale kitchens |
| `food_schedule_meal_program` | Food | Recurring cooked-meal program |
| `dineout_community_table` | Dineout | Festival community dinners |
| `generate_80g_receipt` | **Our layer** | Compliance PDF |
| `impact_dashboard_update` | **Our layer** | ESG metrics rollup |

## On the "missing MCP" question

The architecture note we'd send Swiggy:

> Today's MCPs support the full procurement path we need (search → cart → recurring orders across Food/Instamart + reservations on Dineout). Stretch features — surplus/near-expiry inventory routing to NGOs at deeper discount, dedicated Assure/wholesale endpoints — would benefit from future MCP endpoints. Happy to co-design those with the Swiggy team if the pilot shows traction.

We don't fake the gap. We frame it as *partnership opportunity* rather than *missing dependency*.

## Demo script (90s Loom)

1. **Hook (10s):** CFO inbox: *"Q4 CSR utilization — 38% unspent, deadline March 31."*
2. **Brief (15s):** in Slack #csr-procurement, type the example. Bot replies with a structured plan: ₹1.2L Instamart staples (8 weeks) + ₹80k Food cooked meals (2 partner kitchens, weekly drops Sat 11am).
3. **Confirm (10s):** click confirm. Right-pane "Live MCP calls" timeline lights up with `instamart_search_bulk → instamart_schedule_recurring → food_partner_kitchens → food_schedule_meal_program → generate_80g_receipt → impact_dashboard_update`.
4. **Result (35s):** Impact dashboard updates: 500 meals served · ₹40k deployed · ₹80/meal · 200kg CO₂ avoided. Auto-generated 80G PDF link.
5. **Tagline (5s):** *"CSR, on autopilot. Powered by Swiggy."*

## To run locally

```bash
cp .env.example .env   # add ANTHROPIC_API_KEY
npm install
npm run dev   # runs on :3001 to coexist with Group Concierge on :3000
```

## To productize beyond the demo

1. Replace `lib/mock-mcp.ts` function bodies with real Swiggy MCP client calls.
2. Wrap the `/api/chat` route in a Slack Bolt event handler — `app_mention` and `slash_command` triggers.
3. Add a Postgres-backed program registry for recurring-cron scheduling (BullMQ + Neon works).
4. NGO registry with Darpan ID + 12A/80G verification (real product layer).
5. Razorpay corporate payments + GSTIN-tagged invoices.
