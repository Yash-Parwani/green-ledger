# Swiggy Builders Club Submissions

Two distinct submissions to the Swiggy Builders Club MCP program (`mcp.swiggy.com/builders/`), each in its own folder with its own demo, build prompt, and pitch.

| Project | Wedge | Integration | Folder |
|--------|-------|-------------|--------|
| 🍱 **The Group Concierge** | Consumer events (kitty parties, society potlucks, housewarmings) | AI Agent / Copilot | [`group-concierge/`](./group-concierge) |
| ⚡ **Second Helping** | B2B programmatic CSR procurement | Slack/Teams Bot | [`second-helping/`](./second-helping) |

Both demos:
- Use **OpenAI `gpt-5-mini`** with `reasoning_effort: "medium"` (Chat Completions API, manual tool-call loop)
- Mock the three Swiggy MCPs (**Food**, **Instamart**, **Dineout**) in `lib/mock-mcp.ts` — clearly labelled, swap-for-real once Swiggy grants access
- Render the live MCP-call trajectory in the UI so reviewers can see the agent reasoning end-to-end

## Quick start

Each project is independent. From the relevant folder:

```bash
cp .env.example .env   # add OPENAI_API_KEY
npm install
npm run dev
```

- Group Concierge → http://localhost:3000
- Second Helping → http://localhost:3001 (different port so both can run side-by-side)

## Why two

Group Concierge and Second Helping share the same engine but target completely different users, surfaces, and moats:

- **Different users** — consumer hosts vs corporate CSR teams
- **Different surface** — web chat vs Slack
- **Different moat** — orchestration + aggregation vs programmatic procurement + compliance

A reviewer cross-referencing should see "same founder, two distinct wedges," not duplicate work.
