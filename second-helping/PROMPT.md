# Build Prompt — Second Helping

> Use this as the spec to regenerate or extend the project.

## What we're building (the full vision)

**Second Helping** is a Slack/Teams-native AI agent that turns Swiggy's last-mile network into India's default rail for corporate CSR. The headline use case — and the one that motivated the project — is **rescuing cancelled/failed Swiggy Food orders by rerouting them to verified NGOs against a corporate's standing CSR budget**, so:

- The restaurant gets paid in full instead of eating the cancellation loss.
- The NGO gets a hot meal at the speed of Bolt/Genie, not next week.
- The corporate's mandatory 2% CSR spend (Companies Act §135) auto-deploys.
- Swiggy gets a real, audited "meals rescued from waste" number for ESG reporting and a measurable restaurant-retention lever.

A second, complementary lane runs **scheduled procurement** for predictable program needs: weekly bulk staples (Instamart), daily/weekly cooked meals from FSSAI-certified partner kitchens (Food), festival community dinners (Dineout). 80G receipts and ESG dashboards generate automatically.

The rescue lane is the unlock. The procurement lane is the steady-state revenue.

## v1 scope — the subset we can ship on today's MCPs

The rescue lane needs MCP surface that isn't exposed today (cancellation webhook + delivery redirect). We deliberately did not fake those in the demo.

**v1 ships only the procurement lane**, which is fully buildable on Food / Instamart / Dineout MCPs as they exist today:

- Slack thread → CFO/CSR head briefs the agent in plain English
- Agent proposes a smart split (~70% Instamart bulk staples, ~30% Food partner-kitchen cooked meals; Dineout community tables on festival weeks)
- On approval: executes, schedules recurrence, generates 80G PDF, updates ESG dashboard

This is what the demo in this repo does.

## v2 scope — the rescue lane (what we want from Swiggy)

Two new bits of MCP surface unlock the headline use case:

| Endpoint | Shape | Purpose |
|----------|-------|---------|
| `food.order.cancelled` (webhook) | fires with `{order_id, items[], restaurant_lat_lng, estimated_value_inr, minutes_since_prep, partner_consent: true}` | Tell us when food has been cooked but the order won't reach the original customer |
| `food.order.failed_post_prep` (webhook) | same shape | Same idea, different cause |
| `food.delivery.redirect` (method) | `redirect(order_id, new_drop_address, reason_payload)` → returns `{rider_id, new_eta}` | Reroute the in-flight Bolt/Genie rider to a different verified drop |

Plus a partner-restaurant opt-in flag (probably already exists internally) and standard rate-limiting / abuse protection on `redirect`.

**The Second Helping rescue flow once those land:**

1. We maintain a geo-indexed registry of verified NGOs/shelters (Darpan ID + 12A/80G + capacity windows + dietary acceptance).
2. We subscribe to cancellation/failure webhooks for opted-in partner restaurants.
3. On event: the agent matches the order → nearest NGO with matching capacity in delivery radius → debits the standing corporate CSR budget for the order value → calls `food.delivery.redirect`.
4. Logs the rescue in the corporate's impact dashboard. 80G receipt generates against the redirected order value.

**Why this is *Swiggy-shaped* and not a generic CSR startup:**

- **Defensibility** — only the operator who controls the order lifecycle *and* the last mile can do this. We can't replicate it without the primitives.
- **Restaurant retention** — partners stop absorbing cancellation losses. This is a real, measurable lever.
- **Auditable ESG numbers** — Swiggy can publish "X lakh meals rescued from waste" with a verifiable trail, not a marketing claim.
- **CSR funds at zero marginal logistics cost** — rider already dispatched, food already cooked, corporate budget already committed. Pure margin.

## Why we're flagging it now even though we can't build it yet

If v1 (procurement) shows traction with corporates, v2 (rescue) is the obvious unlock — and it's the kind of capability that turns Swiggy from a transactional platform into the default pipe for India's CSR-meets-food-rescue infrastructure.

We'd love to be the first integration partner if the Builders Club team is open to co-designing these endpoints. If not, no hard feelings — v1 is real and ships on today's APIs. We just thought it was worth saying out loud rather than pretending we hadn't noticed.

## Tech stack

- **Next.js 15 (App Router) + React 19 + TypeScript**
- **OpenAI SDK** (`openai`) with `gpt-5-mini` + `reasoning_effort: "medium"`, Chat Completions API with manual tool-call loop
- **Slack-style UI** in the demo; production wraps the same backend in a Slack Bolt app
- **Mock MCP clients** in `lib/mock-mcp.ts` — same swap-for-real pattern as Group Concierge

## v1 architecture

```
CSR admin → Slack #csr-procurement
         → Second Helping bot (Slack Bolt, swappable)
         → OpenAI agent loop (gpt-5-mini, medium reasoning) with 7 tools:
             ├─ Instamart: search_bulk, schedule_recurring
             ├─ Food: partner_kitchens, schedule_meal_program
             ├─ Dineout: community_table
             └─ Our layer: generate_80g_receipt, impact_dashboard_update
         → returns plan; on approval, executes weekly cron
```

## v1 tools (what's implemented in the demo)

| Tool | MCP | Purpose |
|------|-----|---------|
| `instamart_search_bulk` | Instamart | Find best per-kg price for staples |
| `instamart_schedule_recurring` | Instamart | Set up biweekly bulk drops to NGO |
| `food_partner_kitchens` | Food | Find FSSAI-certified scale kitchens |
| `food_schedule_meal_program` | Food | Recurring cooked-meal program |
| `dineout_community_table` | Dineout | Festival community dinners |
| `generate_80g_receipt` | **Our layer** | Compliance PDF |
| `impact_dashboard_update` | **Our layer** | ESG metrics rollup |

## v2 tools (would add once Swiggy ships the hooks)

| Tool | MCP | Purpose |
|------|-----|---------|
| `food_subscribe_cancellation_webhook` | Food (v2) | Register for partner-restaurant cancellation events |
| `food_redirect_delivery` | Food (v2) | Reroute in-flight delivery to alternate address |
| `ngo_match_by_geo` | **Our layer** | Match an in-flight order to nearest NGO with capacity |
| `csr_budget_debit` | **Our layer** | Atomically debit corporate's standing budget for a rescued order |

## Demo script (90s Loom — v1 procurement)

1. **Hook (10s):** CFO inbox: *"Q4 CSR utilization — 38% unspent, deadline March 31."*
2. **Brief (15s):** in Slack #csr-procurement, type the example. Bot replies with structured plan.
3. **Confirm (10s):** click confirm. Right-pane "Live MCP calls" timeline lights up.
4. **Result (35s):** impact dashboard updates with meals served, ₹/meal, CO₂ avoided. Auto-generated 80G PDF.
5. **Vision close (20s):** "v1 ships today on the procurement use case. v2 — cancelled-order rescue — needs new MCP surface and is described in the README. We'd love to co-design it."

## To run locally

```bash
cp .env.example .env   # add OPENAI_API_KEY
npm install
npm run dev   # runs on :3001 to coexist with Group Concierge on :3000
```

## To productize beyond the demo

1. Replace `lib/mock-mcp.ts` function bodies with real Swiggy MCP client calls.
2. Wrap the `/api/chat` route in a Slack Bolt event handler — `app_mention` and `slash_command` triggers.
3. Add a Postgres-backed program registry for recurring-cron scheduling (BullMQ + Neon works).
4. NGO registry with Darpan ID + 12A/80G verification + geo-index for v2 matching.
5. Razorpay corporate payments + GSTIN-tagged invoices.
6. Once Swiggy ships cancellation webhooks + redirect: add the rescue lane on top of the same orchestration layer.
