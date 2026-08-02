"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { useAgentChat } from "@/lib/shared/useAgentChat";
import { extractPlanCards } from "@/lib/group-concierge/extractPlans";
import { TOOL_SOURCE } from "@/lib/group-concierge/toolSource";
import { ChatBubble } from "@/components/ui/ChatBubble";
import { Markdown } from "@/components/ui/Markdown";
import { ChatComposer } from "@/components/ui/ChatComposer";
import { PlanCard } from "@/components/ui/PlanCard";
import { QuickReplyChips } from "@/components/ui/QuickReplyChips";
import { ToolTrajectory } from "@/components/ui/ToolTrajectory";
import { Button } from "@/components/ui/Button";

const EXAMPLES = [
  "Whitefield RWA Diwali potluck for 60 households, need venue + drinks + decor, ₹85k pooled budget",
  "Team offsite for 25 people in Bandra next Saturday, ₹20k company budget, mixed veg/non-veg",
  "CSR-sponsored community lunch for 40 kids at an NGO in Indiranagar tomorrow, ₹15k",
];

const CLARIFY_CHIPS: { keyword: string; options: string[] }[] = [
  { keyword: "dietary", options: ["Mixed veg/non-veg", "Vegetarian only", "Jain, no onion/garlic"] },
  { keyword: "veg/non-veg", options: ["Mixed veg/non-veg", "Vegetarian only", "Jain, no onion/garlic"] },
  { keyword: "budget", options: ["₹15,000", "₹25,000", "₹40,000"] },
  { keyword: "headcount", options: ["12 guests", "25 guests", "50 guests"] },
  { keyword: "how many", options: ["12 guests", "25 guests", "50 guests"] },
  { keyword: "date", options: ["This Saturday", "Next Saturday", "Tomorrow evening"] },
];

export function CommunityConsole({ chat }: { chat: ReturnType<typeof useAgentChat> }) {
  const { messages, trajectory, loading, send } = chat;
  const [input, setInput] = useState("");
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [dismissedCardIds, setDismissedCardIds] = useState<Set<string>>(new Set());
  const messagesRef = useRef<HTMLDivElement>(null);

  const planCards = useMemo(
    () => extractPlanCards(trajectory).filter((c) => !dismissedCardIds.has(c.toolId)),
    [trajectory, dismissedCardIds]
  );

  useEffect(() => {
    messagesRef.current?.scrollTo(0, messagesRef.current.scrollHeight);
  }, [messages, loading, planCards]);

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant")?.content ?? "";
  const clarifyChips = CLARIFY_CHIPS.find((c) => lastAssistant.toLowerCase().includes(c.keyword))?.options;

  function handleSend(text: string) {
    setInput("");
    send(text);
  }

  function confirmPlan() {
    const parts = planCards
      .map((card) => {
        const chosenId = selections[card.label];
        const chosen = card.options.find((o) => o.id === chosenId) ?? card.options[0];
        return chosen ? `${card.label.split(" · ")[0]}: ${chosen.title}` : null;
      })
      .filter(Boolean);
    setDismissedCardIds((prev) => {
      const next = new Set(prev);
      for (const c of planCards) next.add(c.toolId);
      return next;
    });
    handleSend(`Go ahead and book this: ${parts.join("; ")}.`);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <section className="flex h-[calc(100vh-220px)] min-h-[480px] flex-col rounded-2xl border border-ink-200 bg-white">
        <header className="border-b border-ink-200 px-5 py-4">
          <h1 className="font-display text-lg text-ink-900">🍱 The Group Concierge</h1>
          <p className="text-xs text-ink-500">
            One brief. One agent. Dineout + Food + Instamart, orchestrated for community &amp; company events.
          </p>
        </header>

        <div ref={messagesRef} className="flex-1 space-y-4 overflow-y-auto scrollbar-thin px-5 py-4">
          {messages.length === 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-ink-500">Try an example:</p>
              {EXAMPLES.map((e) => (
                <button
                  key={e}
                  onClick={() => handleSend(e)}
                  className="rounded-xl border border-ink-200 bg-paper/40 px-3.5 py-2.5 text-left text-sm text-ink-700 transition-colors hover:border-orange-300 hover:bg-orange-50"
                >
                  {e}
                </button>
              ))}
            </div>
          )}

          {messages.map((m, i) => (
            <ChatBubble key={i} role={m.role}>
              <Markdown tone={m.role === "user" ? "dark" : "light"}>{m.content}</Markdown>
            </ChatBubble>
          ))}

          {planCards.length > 0 && (
            <div className="flex flex-col gap-3 pt-1">
              {planCards.map((card) => (
                <PlanCard
                  key={card.label}
                  label={card.label}
                  accent={card.accent}
                  options={card.options}
                  selectedId={selections[card.label] ?? card.options[0]?.id}
                  onSelect={(id) => setSelections((s) => ({ ...s, [card.label]: id }))}
                />
              ))}
              <Button onClick={confirmPlan} disabled={loading} className="self-start">
                Confirm &amp; book this plan
              </Button>
            </div>
          )}

          {loading && (
            <ChatBubble role="assistant">
              <span className="italic text-ink-400">Planning across Swiggy…</span>
            </ChatBubble>
          )}
        </div>

        <div className="border-t border-ink-200 px-5 py-4">
          {clarifyChips && !loading && (
            <div className="mb-2.5">
              <QuickReplyChips options={clarifyChips} onPick={handleSend} />
            </div>
          )}
          <ChatComposer
            value={input}
            onChange={setInput}
            onSend={handleSend}
            loading={loading}
            placeholder="Describe your event in one sentence…"
            sendLabel="Plan it"
          />
        </div>
      </section>

      <aside className="rounded-2xl border border-ink-200 bg-white p-4">
        <ToolTrajectory
          trajectory={trajectory}
          sourceMap={TOOL_SOURCE}
          emptyHint="Tool invocations from Food, Instamart, and Dineout MCP servers will stream here."
        />
      </aside>
    </div>
  );
}
