"use client";

import { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };
type TrajEntry =
  | { kind: "tool_use"; name: string; input: unknown; id: string }
  | { kind: "tool_result"; id: string; output: unknown };

const EXAMPLES = [
  "Sponsor 500 meals/week for Asha Kiran shelter in Bangalore. ₹40k/month, veg, nut-free.",
  "We have ₹2L left in CSR this quarter. Deploy across 3 NGOs in Mumbai before March 31.",
  "Set up Diwali community dinner for 80 kids at Saravana Bhavan + weekly khichdi program.",
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [trajectory, setTrajectory] = useState<TrajEntry[]>([]);
  const [metrics, setMetrics] = useState({ meals: 0, spent: 0, ngos: 0, co2: 0 });
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesRef.current?.scrollTo(0, messagesRef.current.scrollHeight);
  }, [messages, loading]);

  // Roll up impact metrics from any impact_dashboard_update tool calls
  useEffect(() => {
    let meals = 0, spent = 0, co2 = 0;
    const ngos = new Set<string>();
    for (const t of trajectory) {
      if (t.kind === "tool_use" && t.name === "impact_dashboard_update") {
        const i = t.input as { meals_served?: number; amount_spent_inr?: number; beneficiary_ngo?: string };
        meals += i.meals_served ?? 0;
        spent += i.amount_spent_inr ?? 0;
        if (i.beneficiary_ngo) ngos.add(i.beneficiary_ngo);
      }
      if (t.kind === "tool_result") {
        const o = (t.output as { ok: boolean; data?: { co2_saved_kg?: number } }).data;
        if (o?.co2_saved_kg) co2 += o.co2_saved_kg;
      }
    }
    setMetrics({ meals, spent, ngos: ngos.size, co2 });
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
      </aside>

      <main className="chat">
        <div className="chat-header">
          <div className="title"># csr-procurement</div>
          <div className="desc">Programmatic CSR via Swiggy · ₹2.4Cr deployed YTD · 4 active programs</div>
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
                <div className="msg-text" style={{ color: "#6f6e72", fontStyle: "italic" }}>
                  Allocating across Instamart bulk + Food partner kitchens…
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
        <h2>Impact this session</h2>
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
        <div className="metric">
          <div className="label">CO₂ avoided</div>
          <div className="value">{metrics.co2} kg</div>
          <div className="delta">vs siloed procurement</div>
        </div>

        <div className="tool-log">
          <h2>Live MCP calls</h2>
          {trajectory.length === 0 ? (
            <div style={{ color: "#6f6e72", fontSize: 12, fontStyle: "italic" }}>
              Tool calls will stream here as the agent works.
            </div>
          ) : (
            trajectory
              .filter((t) => t.kind === "tool_use")
              .slice(-10)
              .map((t, i) => (
                <div key={i} className="tool-entry">
                  <span className="tname">{(t as { name: string }).name}</span>
                </div>
              ))
          )}
        </div>
      </aside>
    </div>
  );
}
