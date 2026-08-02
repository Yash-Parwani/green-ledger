"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { useAgentChat } from "@/lib/shared/useAgentChat";
import { buildDashboardData } from "@/lib/second-helping/dashboardData";
import { extractPlanCards, extractPaymentSimulations, extractApprovalRequests } from "@/lib/second-helping/extractPlans";
import { TOOL_SOURCE } from "@/lib/second-helping/toolSource";
import { ChatBubble } from "@/components/ui/ChatBubble";
import { Markdown } from "@/components/ui/Markdown";
import { ChatComposer } from "@/components/ui/ChatComposer";
import { ToolTrajectory } from "@/components/ui/ToolTrajectory";
import { MetricTile } from "@/components/ui/MetricTile";
import { PlanCard } from "@/components/ui/PlanCard";
import { PaymentSimulatedCard } from "@/components/ui/PaymentSimulatedCard";
import { ApprovalCard } from "@/components/ui/ApprovalCard";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/shared/cn";
import { ApprovalsPanel } from "@/components/console/ApprovalsPanel";
import { DoneesPanel } from "@/components/console/DoneesPanel";

const EXAMPLES = [
  "Sponsor 500 meals/week for Asha Kiran shelter. ₹40k/month, veg, nut-free.",
  "We have ₹2L left in CSR this quarter. Check our budget status and deploy before March 31.",
  "Set up Diwali community dinner for 80 kids at Saravana Bhavan + weekly khichdi program.",
  "How is our CSR utilization looking? What should we deploy this month?",
];

// Corporate identity is server state behind a signed session cookie — it is
// not kept in localStorage, and the client never holds an org id. This is a
// display copy of what the server says the session's org is.
type CorporateProfile = {
  corporate_name: string;
  annual_budget_inr: number;
};

export function CsrConsole({ chat }: { chat: ReturnType<typeof useAgentChat> }) {
  const { messages, trajectory, loading, send } = chat;
  const [input, setInput] = useState("");
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [dismissedCardIds, setDismissedCardIds] = useState<Set<string>>(new Set());
  const [profile, setProfile] = useState<CorporateProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [regName, setRegName] = useState("");
  const [regBudget, setRegBudget] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [registering, setRegistering] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/second-helping/setup-profile");
        const { profile: p } = await res.json();
        if (!cancelled && p) setProfile(p);
      } catch {
        // offline / blocked — fall through to the registration form
      } finally {
        if (!cancelled) setProfileLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function registerProfile() {
    const budget = Number(regBudget.replace(/[^\d.]/g, ""));
    if (!regName.trim() || !budget || !regEmail.includes("@")) return;
    setRegistering(true);
    try {
      const res = await fetch("/api/second-helping/setup-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          corporate_name: regName.trim(),
          annual_budget_inr: budget,
          admin_email: regEmail.trim(),
        }),
      });
      if (res.ok) setProfile(await res.json());
    } finally {
      setRegistering(false);
    }
  }

  async function changeProfile() {
    await fetch("/api/second-helping/setup-profile", { method: "DELETE" });
    setProfile(null);
    setRegName("");
    setRegBudget("");
  }

  const { metrics, budget, programs } = useMemo(() => buildDashboardData(trajectory), [trajectory]);
  const planCards = useMemo(
    () => extractPlanCards(trajectory).filter((c) => !dismissedCardIds.has(c.toolId)),
    [trajectory, dismissedCardIds]
  );
  const paymentSimCards = useMemo(() => extractPaymentSimulations(trajectory), [trajectory]);
  const approvalRequests = useMemo(() => extractApprovalRequests(trajectory), [trajectory]);
  // Bumped when an approval is recorded, so the side panels re-read too.
  const [approvalsVersion, setApprovalsVersion] = useState(0);

  useEffect(() => {
    messagesRef.current?.scrollTo(0, messagesRef.current.scrollHeight);
  }, [messages, loading, planCards]);

  // A plan card is a question about *right now*. Once the user has replied —
  // by picking an option or by typing straight past it — the question has been
  // answered, so the card retires.
  //
  // Previously cards were only dismissed by the "Use this" button, so anyone
  // who answered in prose left a live chooser sitting under a conversation
  // that had moved on, and the next search stacked another one underneath.
  // Re-offering a choice the user already made in words reads as the agent
  // not having listened.
  function retireOpenCards() {
    if (planCards.length === 0) return;
    setDismissedCardIds((prev) => {
      const next = new Set(prev);
      for (const c of planCards) next.add(c.toolId);
      return next;
    });
  }

  function handleSend(text: string) {
    setInput("");
    retireOpenCards();
    // No profile in the payload — the server reads the org off the session.
    send(text);
  }

  function confirmSelection() {
    const parts = planCards
      .map((card) => {
        const chosenId = selections[card.label];
        const chosen = card.options.find((o) => o.id === chosenId) ?? card.options[0];
        return chosen ? `${card.label.split(" · ")[0]}: ${chosen.title}` : null;
      })
      .filter(Boolean);
    // handleSend retires the open cards.
    handleSend(`Go with: ${parts.join("; ")}. Pull bulk coupons and quote the landed cost.`);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <section className="flex h-[calc(100vh-220px)] min-h-[480px] flex-col rounded-2xl border border-ink-200 bg-white">
        <header className="border-b border-ink-200 px-5 py-4">
          <h1 className="font-display text-lg text-ink-900">⚡ Second Helping</h1>
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-500">
              Programmatic CSR via Swiggy · {programs.length} active program{programs.length === 1 ? "" : "s"}
            </p>
            {profile && (
              <p className="text-xs text-ink-500">
                Registered as <span className="font-medium text-ink-700">{profile.corporate_name}</span> ·{" "}
                <button type="button" onClick={changeProfile} className="underline underline-offset-2 hover:text-ink-800">
                  change
                </button>
              </p>
            )}
          </div>
        </header>

        <div ref={messagesRef} className="flex-1 space-y-4 overflow-y-auto scrollbar-thin px-5 py-4">
          {messages.length === 0 && profileLoaded && !profile && (
            <div className="flex flex-col gap-3 rounded-xl border border-green-200 bg-green-50/50 p-4">
              <div>
                <p className="text-sm font-semibold text-ink-800">Register your corporate CSR profile</p>
                <p className="mt-0.5 text-xs text-ink-500">
                  One-time setup. Your email is the CSR admin of record — you approve commitments
                  under ₹5,00,000 yourself, and above that a second approver signs off.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Corporate name, e.g. Radiance Corp"
                  className="flex-1 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 placeholder:text-ink-400 focus:border-green-400 focus:outline-none"
                />
                <input
                  value={regBudget}
                  onChange={(e) => setRegBudget(e.target.value)}
                  placeholder="Annual CSR budget, e.g. 400000"
                  inputMode="numeric"
                  className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 placeholder:text-ink-400 focus:border-green-400 focus:outline-none sm:w-56"
                />
              </div>
              <input
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="CSR admin email, e.g. priya@radiance.in"
                type="email"
                className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 placeholder:text-ink-400 focus:border-green-400 focus:outline-none"
              />
              <Button
                onClick={registerProfile}
                disabled={registering || !regName.trim() || !regBudget.trim() || !regEmail.includes("@")}
                variant="success"
                className="self-start"
              >
                {registering ? "Registering…" : "Register & start"}
              </Button>
            </div>
          )}

          {messages.length === 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-ink-500">Try an example:</p>
              {EXAMPLES.map((e) => (
                <button
                  key={e}
                  onClick={() => handleSend(e)}
                  className="rounded-xl border border-ink-200 bg-paper/40 px-3.5 py-2.5 text-left text-sm text-ink-700 transition-colors hover:border-green-300 hover:bg-green-50"
                >
                  {e}
                </button>
              ))}
            </div>
          )}

          {messages.map((m, i) => (
            <ChatBubble key={i} role={m.role} author={m.role === "assistant" ? "Second Helping" : undefined}>
              {m.role === "assistant" ? (
                <Markdown>{m.content}</Markdown>
              ) : (
                <Markdown tone="dark">{m.content}</Markdown>
              )}
            </ChatBubble>
          ))}

          {planCards.length > 0 && (
            <div className="flex flex-col gap-3 pt-1">
              {/* Side by side once there's more than one. These are usually
                  alternatives being compared — staples vs cooked meals, rice
                  vs dal — and a vertical stack makes the reader scroll to
                  hold two options in their head at once. */}
              <div
                className={cn(
                  "grid gap-3",
                  planCards.length > 1 ? "sm:grid-cols-2" : "grid-cols-1"
                )}
              >
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
              </div>
              <Button onClick={confirmSelection} disabled={loading} variant="success" className="self-start">
                {planCards.length > 1 ? "Use these" : "Use this"}
              </Button>
            </div>
          )}

          {paymentSimCards.length > 0 && (
            <div className="flex flex-col gap-3 pt-1">
              {paymentSimCards.map((card) => (
                <PaymentSimulatedCard
                  key={card.toolId}
                  label={card.label}
                  accent={card.accent}
                  ngo={card.ngo}
                  lines={card.lines}
                  perDrop={card.perDrop}
                  total={card.total}
                  note={card.note}
                />
              ))}
            </div>
          )}

          {/* Inline, under the message that proposed the spend — approving
              belongs where the agent asked, not in a panel off to the side. */}
          {approvalRequests.length > 0 && (
            <div className="flex flex-col gap-3 pt-1">
              {approvalRequests.map((req) => (
                <ApprovalCard
                  key={req.proposalId}
                  proposalId={req.proposalId}
                  onDecided={() => setApprovalsVersion((v) => v + 1)}
                />
              ))}
            </div>
          )}

          {loading && (
            <ChatBubble role="assistant" author="Second Helping">
              <span className="italic text-ink-400">Checking budget · Searching Swiggy MCPs · Stacking coupons…</span>
            </ChatBubble>
          )}
        </div>

        <div className="border-t border-ink-200 px-5 py-4">
          <ChatComposer
            value={input}
            onChange={setInput}
            onSend={handleSend}
            loading={loading}
            placeholder="Brief the agent on your CSR program…"
          />
        </div>
      </section>

      <aside className="flex flex-col gap-5">
        <div className="rounded-2xl border border-ink-200 bg-white p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">CSR budget</h2>
          {budget ? (
            <div>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-xs text-ink-500">Utilization</span>
                <span
                  className={
                    budget.utilization_pct < 60
                      ? "text-sm font-semibold text-orange-600"
                      : "text-sm font-semibold text-green-600"
                  }
                >
                  {budget.utilization_pct}%
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={budget.utilization_pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="CSR budget utilization"
                className="h-2 w-full overflow-hidden rounded-full bg-ink-100"
              >
                <div
                  className={budget.utilization_pct < 60 ? "h-full bg-orange-500" : "h-full bg-green-500"}
                  style={{ width: `${budget.utilization_pct}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-ink-600">
                ₹{budget.spent.toLocaleString("en-IN")} spent of ₹{budget.total.toLocaleString("en-IN")}
              </p>
              <p className="text-xs text-ink-500">
                ₹{budget.remaining.toLocaleString("en-IN")} remaining · {budget.days_left}d to year-end
              </p>
              {budget.utilization_pct < 60 && (
                <p className="mt-1.5 text-xs font-medium text-orange-600">⚠ Underspend risk</p>
              )}
            </div>
          ) : (
            <p className="text-xs italic text-ink-400">Ask the agent to check your budget.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <MetricTile label="Meals served" value={metrics.meals.toLocaleString("en-IN")} accent="green" />
          <MetricTile label="CSR deployed" value={`₹${metrics.spent.toLocaleString("en-IN")}`} accent="orange" />
          <MetricTile label="Coupon savings" value={`₹${metrics.savings.toLocaleString("en-IN")}`} />
          <MetricTile
            label="Cost per meal"
            value={metrics.costPerMeal > 0 ? `₹${metrics.costPerMeal.toLocaleString("en-IN")}` : "—"}
            accent="green"
          />
        </div>

        {/* Keyed off trajectory length so a policy refusal or a fresh proposal
            shows up as soon as the agent's turn lands, without polling. */}
        <ApprovalsPanel refreshKey={trajectory.length + approvalsVersion} />
        <DoneesPanel refreshKey={trajectory.length + approvalsVersion} />

        {programs.length > 0 && (
          <div className="rounded-2xl border border-ink-200 bg-white p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Scheduled programs</h2>
            <div className="flex flex-col gap-2">
              {programs.map((p) => (
                <div key={p.program_id} className="rounded-lg border border-ink-200 px-3 py-2 text-xs">
                  <p className="font-medium text-ink-800">{p.program_name}</p>
                  <p className="text-ink-500">{p.ngo}</p>
                  <p className="mt-1 flex justify-between text-ink-500">
                    <span>{p.cadence}</span>
                    <span>₹{p.total_budget_inr.toLocaleString("en-IN")}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-ink-200 bg-white p-4">
          <ToolTrajectory
            trajectory={trajectory}
            sourceMap={TOOL_SOURCE}
            emptyHint="Tool calls will stream here as the agent works."
          />
        </div>
      </aside>
    </div>
  );
}
