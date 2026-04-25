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
  api/chat/route.ts     → agent loop (Anthropic SDK + 7 tools)
lib/
  tools.ts              → MCP + compliance tool schemas + system prompt
  mock-mcp.ts           → mock MCP + compliance implementations
PROMPT.md               → full build spec
```

## On the MCP gap

Today's MCPs support the procurement path end-to-end (search → cart → recurring orders + reservations). Stretch features — surplus/near-expiry inventory routing to NGOs at deeper discount, dedicated wholesale endpoints — would benefit from future MCP endpoints, and we'd love to co-design them with the Swiggy team if the pilot shows traction.

## Built with

- OpenAI `gpt-5-mini` with `reasoning_effort: "medium"` (`openai` SDK)
- Next.js 15 + React 19 + TypeScript
- Mock Swiggy MCP clients (Food, Instamart, Dineout) + internal compliance layer
