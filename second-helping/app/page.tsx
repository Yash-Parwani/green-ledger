"use client";

import { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };
type TrajEntry =
  | { kind: "tool_use"; name: string; input: unknown; id: string }
  | { kind: "tool_result"; id: string; output: unknown };

type ActiveProgram = {
  program_id: string;
  program_name: string;
  ngo: string;
  cadence: string;
  total_budget_inr: number;
  next_run: string;
};

const EXAMPLES = [
  "Sponsor 500 meals/week for Asha Kiran shelter in Bangalore. ₹40k/month, veg, nut-free.",
  "We have ₹2L left in CSR this quarter. Check our budget status and deploy before March 31.",
  "Set up Diwali community dinner for 80 kids at Saravana Bhavan + weekly khichdi program.",
  "How is our CSR utilization looking? What should we deploy this month?",
];

// Map tool names to their source (for the MCP call log badge)
const TOOL_SOURCE: Record<string, { label: string; color: string }> = {
  instamart_search_bulk:      { label: "Instamart MCP", color: "#f97316" },
  instamart_schedule_recurring: { label: "Instamart MCP", color: "#f97316" },
  track_instamart_order:      { label: "Instamart MCP", color: "#f97316" },
  food_partner_kitchens:      { label: "Food MCP",      color: "#ef4444" },
  fetch_food_coupons:         { label: "Food MCP",      color: "#ef4444" },
  apply_food_coupon:          { label: "Food MCP",      color: "#ef4444" },
  food_schedule_meal_program: { label: "Food MCP",      color: "#ef4444" },
  track_food_order:           { label: "Food MCP",      color: "#ef4444" },
  dineout_community_table:    { label: "Dineout MCP",   color: "#8b5cf6" },
  get_dineout_booking_status: { label: "Dineout MCP",   color: "#8b5cf6" },
  csr_budget_status:          { label: "Our Layer",     color: "#1164a3" },
  schedule_program:           { label: "Our Layer",     color: "#1164a3" },
  generate_80g_receipt:       { label: "Our Layer",     color: "#1164a3" },
  impact_dashboard_update:    { label: "Our Layer",     color: "#1164a3" },
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [trajectory, setTrajectory] = useState<TrajEntry[]>([]);
  const [metrics, setMetrics] = useState({ meals: 0, spent: 0, ngos: 0, co2: 0, savings: 0 });
  const [budget, setBudget] = useState<{ total: number; spent: number; remaining: number; utilization_pct: number; days_left: number } | null>(null);
  const [programs, setPrograms] = useState<ActiveProgram[]>([]);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesRef.current?.scrollTo(0, messagesRef.current.scrollHeight);
  }, [messages, loading]);

  // Roll up metrics + budget + programs from trajectory
  useEffect(() => {
    let meals = 0, spent = 0, co2 = 0, savings = 0;
    const ngos = new Set<string>();
    const newPrograms: ActiveProgram[] = [];

    for (const t of trajectory) {
      if (t.kind === "tool_use" && t.name === "impact_dashboard_update") {
        const i = t.input as { meals_served?: number; amount_spent_inr?: number; beneficiary_ngo?: string };
        meals += i.meals_served ?? 0;
        spent += i.amount_spent_inr ?? 0;
        if (i.beneficiary_ngo) ngos.add(i.beneficiary_ngo);
      }
      if (t.kind === "tool_result") {
        const o = (t.output as { ok: boolean; data?: Record<string, unknown> }).data;
        if (!o) continue;
        if (typeof o.co2_saved_kg === "number") co2 += o.co2_saved_kg;
        if (typeof o.savings_inr === "number") savings += o.savings_inr;
        // Budget status
        if (typeof o.budget_total_inr === "number") {
          setBudget({
            total: o.budget_total_inr as number,
            spent: o.budget_spent_inr as number,
            remaining: o.budget_remaining_inr as number,
            utilization_pct: o.utilization_pct as number,
            days_left: o.days_to_year_end as number,
          });
        }
        // Scheduled programs
        if (o.program_id && o.program_name && o.next_run) {
          const prog = o as unknown as ActiveProgram;
          newPrograms.push({
            program_id: prog.program_id,
            program_name: prog.program_name,
            ngo: prog.ngo,
            cadence: prog.cadence,
            total_budget_inr: prog.total_budget_inr,
            next_run: prog.next_run,
          });
        }
      }
    }

    setMetrics({ meals, spent, ngos: ngos.size, co2, savings });
    if (newPrograms.length > 0) setPrograms((p) => {
      const ids = new Set(p.map((x) => x.program_id));
      return [...p, ...newPrograms.filter((x) => !ids.has(x.program_id))];
    });
  }, [trajectory]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setTrajectory((t) => [...t, ...(data.trajectory ?? [])]);
      setMessages([...next, { role: "assistant", content: data.reply ?? "(no response)" }]);
    } catch (e) {
      setMessages([...next, { role: "assistant", content: `Error: ${(e as Error).message}` }]);
    } finally {
      setLoading(false);
    }
  }

  const time = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Days to next festival (simplified)
  const festivalAlert = getFestivalAlert();

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="workspace">Acme Corp · CSR</div>
        <div className="channel-section">
          <div className="channel-label">Channels</div>
          <div className="channel">#general</div>
          <div className="channel active"># csr-procurement</div>
          <div className="channel">#finance</div>
        </div>
        <div className="channel-section">
          <div className="channel-label">Apps</div>
          <div className="channel">⚡ Second Helping</div>
        </div>
        {festivalAlert && (
          <div className="festival-alert">
            <div className="festival-icon">🎉</div>
            <div>
              <div className="festival-name">{festivalAlert.name}</div>
              <div className="festival-days">in {festivalAlert.days} days</div>
            </div>
          </div>
        )}
      </aside>

      <main className="chat">
        <div className="chat-header">
          <div className="title"># csr-procurement</div>
          <div className="desc">Programmatic CSR via Swiggy · ₹2.4Cr deployed YTD · {programs.length + 4} active programs</div>
        </div>
        {messages.length === 0 && (
          <div className="examples">
            {EXAMPLES.map((e) => (
              <button key={e} onClick={() => send(e)}>{e}</button>
            ))}
          </div>
        )}
        <div className="messages" ref={messagesRef}>
          {messages.map((m, i) => (
            <div key={i} className="msg">
              <div className={`avatar ${m.role === "user" ? "user" : "bot"}`}>
                {m.role === "user" ? "YP" : "SH"}
              </div>
              <div className="msg-body">
                <div className="msg-author">
                  {m.role === "user" ? "you" : "Second Helping"}
                  <span className="ts">{time()}</span>
                </div>
                <div className="msg-text">{m.content}</div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="msg">
              <div className="avatar bot">SH</div>
              <div className="msg-body">
                <div className="msg-author">Second Helping <span className="ts">{time()}</span></div>
                <div className="msg-text loading-dots" style={{ color: "#6f6e72", fontStyle: "italic" }}>
                  Checking budget · Searching Swiggy MCPs · Stacking coupons…
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="composer">
          <form className="composer-box" onSubmit={(e) => { e.preventDefault(); send(input); }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message #csr-procurement"
              disabled={loading}
            />
            <button type="submit" disabled={loading || !input.trim()}>Send</button>
          </form>
        </div>
      </main>

      <aside className="dashboard">
        {/* Budget utilization */}
        <h2>CSR Budget</h2>
        {budget ? (
          <div className="metric budget-metric">
            <div className="budget-row">
              <span className="label">Utilization</span>
              <span className="budget-pct" style={{ color: budget.utilization_pct < 60 ? "#f97316" : "#2bac76" }}>
                {budget.utilization_pct}%
              </span>
            </div>
            <div className="budget-bar-track">
              <div
                className="budget-bar-fill"
                style={{
                  width: `${budget.utilization_pct}%`,
                  background: budget.utilization_pct < 60 ? "#f97316" : "#2bac76",
                }}
              />
            </div>
            <div className="budget-detail">
              <span>₹{budget.spent.toLocaleString("en-IN")} spent</span>
              <span style={{ color: "#6f6e72" }}>of ₹{budget.total.toLocaleString("en-IN")}</span>
            </div>
            <div className="budget-footer">
              ₹{budget.remaining.toLocaleString("en-IN")} remaining · {budget.days_left}d to Mar 31
            </div>
            {budget.utilization_pct < 60 && (
              <div className="budget-warn">⚠️ Underspend risk — agent will flag</div>
            )}
          </div>
        ) : (
          <div className="metric" style={{ color: "#6f6e72", fontSize: 12, fontStyle: "italic" }}>
            Ask the agent to check your budget.
          </div>
        )}

        {/* Impact metrics */}
        <h2 style={{ marginTop: 20 }}>Impact this session</h2>
        <div className="metric">
          <div className="label">Meals served</div>
          <div className="value">{metrics.meals.toLocaleString("en-IN")}</div>
          <div className="delta">across {metrics.ngos} NGO{metrics.ngos === 1 ? "" : "s"}</div>
        </div>
        <div className="metric">
          <div className="label">CSR deployed</div>
          <div className="value">₹{metrics.spent.toLocaleString("en-IN")}</div>
          <div className="delta">{metrics.meals > 0 ? `₹${(metrics.spent / metrics.meals).toFixed(0)}/meal` : "—"}</div>
        </div>
        {metrics.savings > 0 && (
          <div className="metric savings-metric">
            <div className="label">Coupon savings</div>
            <div className="value savings-value">₹{metrics.savings.toLocaleString("en-IN")}</div>
            <div className="delta">from Swiggy bulk coupons</div>
          </div>
        )}
        <div className="metric">
          <div className="label">CO₂ avoided</div>
          <div className="value">{metrics.co2} kg</div>
          <div className="delta">vs siloed procurement</div>
        </div>

        {/* Scheduled programs */}
        {programs.length > 0 && (
          <>
            <h2 style={{ marginTop: 20 }}>Scheduled Programs</h2>
            {programs.map((p) => (
              <div key={p.program_id} className="program-card">
                <div className="program-name">{p.program_name}</div>
                <div className="program-ngo">{p.ngo}</div>
                <div className="program-meta">
                  <span className="program-cadence">{p.cadence}</span>
                  <span className="program-budget">₹{p.total_budget_inr.toLocaleString("en-IN")}</span>
                </div>
                <div className="program-next">▶ Next: {p.next_run}</div>
              </div>
            ))}
          </>
        )}

        {/* Live MCP call log */}
        <div className="tool-log">
          <h2>Live MCP calls</h2>
          {trajectory.length === 0 ? (
            <div style={{ color: "#6f6e72", fontSize: 12, fontStyle: "italic" }}>
              Tool calls will stream here as the agent works.
            </div>
          ) : (
            trajectory
              .filter((t) => t.kind === "tool_use")
              .slice(-12)
              .map((t, i) => {
                const tool = t as { name: string; input: unknown };
                const src = TOOL_SOURCE[tool.name];
                const result = trajectory.find(
                  (r) => r.kind === "tool_result" && (r as { id: string }).id === (t as { id: string }).id
                );
                const isError = result && !(result as { output: { ok: boolean } }).output?.ok;
                return (
                  <div key={i} className={`tool-entry ${isError ? "tool-error" : ""}`}>
                    <div className="tool-header">
                      <span className="tname">{tool.name}</span>
                      {src && (
                        <span className="tool-badge" style={{ background: src.color + "22", color: src.color, border: `1px solid ${src.color}44` }}>
                          {src.label}
                        </span>
                      )}
                    </div>
                    {isError && <div className="tool-error-msg">⚠ {String((result as { output: { error?: string } }).output?.error ?? "error")}</div>}
                  </div>
                );
              })
          )}
        </div>
      </aside>
    </div>
  );
}

function getFestivalAlert(): { name: string; days: number } | null {
  const today = new Date();
  const year = today.getFullYear();
  const festivals = [
    { name: "Diwali",    date: new Date(year, 9, 20) },
    { name: "Eid",       date: new Date(year, 2, 30) },
    { name: "Christmas", date: new Date(year, 11, 25) },
    { name: "Holi",      date: new Date(year, 2, 14) },
    { name: "Pongal",    date: new Date(year, 0, 14) },
  ];
  for (const f of festivals) {
    if (f.date < today) f.date.setFullYear(year + 1);
    const days = Math.ceil((f.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (days > 0 && days <= 30) return { name: f.name, days };
  }
  return null;
}
