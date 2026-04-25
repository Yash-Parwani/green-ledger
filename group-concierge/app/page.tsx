"use client";

import { useState, useRef, useEffect } from "react";

type Message = { role: "user" | "assistant"; content: string };
type TrajEntry =
  | { kind: "tool_use"; name: string; input: unknown; id: string }
  | { kind: "tool_result"; id: string; output: unknown }
  | { kind: "text"; text: string };

const EXAMPLES = [
  "Plan a 25-person housewarming in Bandra next Saturday, ₹20k budget, mixed veg/non-veg",
  "Society Diwali potluck for 40 people in Powai, need venue + drinks + decor, ₹35k",
  "Birthday dinner for 12 in Indiranagar tomorrow 8pm, Asian cuisine, ₹15k",
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [trajectory, setTrajectory] = useState<TrajEntry[]>([]);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesRef.current?.scrollTo(0, messagesRef.current.scrollHeight);
  }, [messages, loading]);

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

  return (
    <div className="app">
      <div className="chat">
        <div className="header">
          <h1>🍱 The Group Concierge</h1>
          <p>One brief. One agent. Dineout + Food + Instamart, orchestrated.</p>
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
            <div key={i} className={`msg ${m.role}`}>{m.content}</div>
          ))}
          {loading && <div className="msg assistant thinking">Planning across Swiggy…</div>}
        </div>
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your event in one sentence…"
            disabled={loading}
          />
          <button type="submit" disabled={loading || !input.trim()}>Plan it</button>
        </form>
      </div>
      <div className="trajectory">
        <h2>MCP Tool Calls (live)</h2>
        {trajectory.length === 0 ? (
          <div className="empty">Tool invocations from Food, Instamart, and Dineout MCP servers will stream here.</div>
        ) : (
          trajectory
            .filter((t) => t.kind !== "text")
            .map((t, i) => (
              <div key={i} className={`traj-entry ${t.kind === "tool_result" ? "result" : ""}`}>
                <div className="label">
                  {t.kind === "tool_use" ? `→ ${t.name}` : `← result`}
                </div>
                <pre>{JSON.stringify(t.kind === "tool_use" ? t.input : (t as { output: unknown }).output, null, 2)}</pre>
              </div>
            ))
        )}
      </div>
    </div>
  );
}
