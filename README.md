# GreenLedger

A Swiggy Builders Club submission. **CSR-first, always.**

Indian companies above a size threshold must deploy 2% of net profit on CSR under
Section 135. Most do it through spreadsheets, email and a Q4 scramble. GreenLedger
is one agent that deploys that budget through Swiggy — and produces the audit trail
a CFO and an auditor actually ask for.

One console, one engine, two modes reached by a single switch — not two separate products:

| Mode | What it does | Default? |
|------|--------------|----------|
| ⚡ **Second Helping** | Deploys a corporate's CSR budget into recurring meal-sponsorship programs — schedules Instamart/Food/Dineout orders, stacks coupons, generates 80G receipts and GST invoices as real PDFs, tracks deployment against budget. | Yes — loads by default |
| 🍱 **The Group Concierge** | Plans **organizational/pooled-spend** events — RWA potlucks, company offsites, CSR-sponsored NGO meals — across the same three Swiggy surfaces. Not personal spend. | One tap away via the mode switch |

## See it running

A full 16-minute walkthrough against a live-connected Swiggy account — real
kitchen search, real menu prices, the policy engine refusing an unverified
donee, human approval, and the generated 80G receipt and GST invoice opening as
real PDFs.

**[media/greenledger-demo.mp4](media/greenledger-demo.mp4)**

Worth knowing while watching: the cart is real and the prices are live, but
checkout is simulated — no order is placed and no money moves. See "Known
limits" below.

## What makes this different from an LLM with tools

The interesting part isn't that the agent can spend money. It's that it **can't
spend it wrongly, even if the prompt is compromised.**

Every tool call — in both modes — passes through a policy engine
(`lib/server/policy.ts`) that runs in code, after the model has chosen its
arguments and before the tool executes. It can hard-refuse, and no prompt turns
it off.

- **Approval is required** for anything that commits money, and it binds to a hash
  of the exact tool call. Approving ₹4L monthly does not approve ₹4L weekly.
- **Every approval is attributed** — recorded against the CSR admin of record, on the
  ledger, with the timestamp. Two-person approval is built but currently switched off;
  it's only meaningful once the second approver can be notified out of band, and until
  then escalation just dead-ends in the console. The threshold is per-organization
  and the machinery stays wired up, so it returns with the notification channel.
- **Donee verification**: no spend against an NGO whose 80G/12A registration a human
  hasn't verified. There is deliberately no tool that lets the agent verify one.
- **Ceilings**: annual budget, 90% utilization, and a rolling 24h cap.
- **Append-only ledger** (`lib/server/ledger.ts`): the repository exposes `append()`
  and reads — no `update()`, no `delete()`. Corrections append; they never overwrite.
  **Refusals are recorded too**, which is how you show an auditor the controls were
  live at the time rather than added afterwards.

Refusals come back structured (`code` / `reason` / `remedy`) so the agent explains
the block and does the right next thing instead of retrying blindly.

## No fabricated data

- The Food, Instamart and Dineout tools (`lib/*/tool-impls.ts`) call the real Swiggy
  Builders Club MCP servers. Without a connected account they return an honest
  `ok:false` — they never invent a restaurant, a vendor or a price.
- The landing page carries no deployment totals or customer names. This product
  hasn't deployed a rupee; there are no numbers pretending otherwise.
- The Impact Ledger renders the real ledger for your session, with an honest empty
  state.
- No CO₂ or ESG-score figure is produced anywhere. BRSR disclosures are audited and
  we have no defensible methodology, so we publish none.
- The agent will not claim CSR spend is tax-deductible. That question is genuinely
  unsettled and donee-dependent; it generates the donee's 80G receipt and routes the
  tax position to the customer's advisers.

## Quick start

```bash
cp .env.example .env    # set ANTHROPIC_API_KEY, and SESSION_SECRET (openssl rand -base64 32)
npm install
npm run dev             # http://localhost:3000
```

Then register an organization in the console — the admin email you give is the
identity approvals are checked against.

## Key routes

- `/` — landing page
- `/console` — the product (`?mode=csr` or `?mode=community`, CSR is default)
- `/second-helping/impact` — the Impact Ledger, rendered from real recorded activity
- `/api/documents/[id]` — generated 80G receipts and GST invoices, served behind
  session authorization

## Known limits (deliberate, not oversights)

- **State is in-memory and resets on restart.** All four stores are repository-shaped
  (`orgStore`, `ledger`, `ngoStore`, `proposals`) so the database swap is one class
  each. The backend decision is still open.
- **Order placement stops before checkout.** Carts are built against live Swiggy with
  real prices, then return `payment_simulated: true`. Swiggy's `place_food_order` has
  no dry-run mode and caps at ₹1,000/order in production, so CSR-scale volume needs
  Swiggy's enterprise ordering path — a partnership conversation, not a code change.
- **The scheduler can't run unattended yet.** Swiggy MCP auth is user-level (phone +
  OTP) with no refresh-token grant, so a cron job has no credential to execute with.
  An org-level credential is a prerequisite for the proactive/scheduled features.

## Layout

```
app/       routes — the console, the landing page, the Impact Ledger,
           the agent endpoints, and /api/documents for generated PDFs
components/ui, components/console — design-system primitives and the two mode bodies
lib/server/   session, policy engine, append-only ledger, donee registry,
              proposals, PDF generation — everything the controls live in
lib/shared/   the agent loop, the Swiggy MCP client, coupon handling
lib/second-helping, lib/group-concierge — tool schemas, system prompts, tool
              implementations, and the extractors that turn a trajectory into cards
scripts/swiggy-mcp-diagnostic.mjs — read-only evidence log against the live
              Swiggy MCP servers; redacts the bearer token
```

The load-bearing files are `lib/server/policy.ts` (the gate), `lib/server/withPolicy.ts`
(which wraps every tool so nothing opts out of it) and `lib/server/ledger.ts`
(append-only, and the single source of truth for how much has been spent).
