"use client";

import { useCallback, useRef, useState } from "react";
import type { TrajEntry } from "@/components/ui/ToolTrajectory";

export type Message = { role: "user" | "assistant"; content: string };

export function useAgentChat(endpoint: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [trajectory, setTrajectory] = useState<TrajEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);

  // Deliberately no `extraBody` escape hatch. It existed so the console could
  // attach the corporate profile (id, name, annual budget) to every chat POST,
  // which made tenant identity and budget client-controlled. Server state
  // belongs on the server — read it from the session in the route handler.
  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || inFlight.current) return;
      inFlight.current = true;
      const next = [...messages, { role: "user" as const, content: text }];
      setMessages(next);
      setLoading(true);
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: next }),
        });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = await res.json();
        setTrajectory((t) => [...t, ...(data.trajectory ?? [])]);
        setMessages([...next, { role: "assistant", content: data.reply ?? "(no response)" }]);
      } catch (e) {
        setMessages([...next, { role: "assistant", content: `Error: ${(e as Error).message}` }]);
      } finally {
        setLoading(false);
        inFlight.current = false;
      }
    },
    [messages, endpoint]
  );

  /**
   * Record a tool call that ran OUTSIDE a chat turn — specifically, the
   * commitment that fires when a human clicks Approve.
   *
   * That execution happens in the approvals route, so without this the chat
   * never learns it happened: the dashboard tiles stay at zero, the programme
   * never appears, and the agent — having no tool result for it — keeps telling
   * the user to click a button they already clicked.
   */
  const recordExternalToolCall = useCallback(
    (name: string, input: unknown, output: unknown) => {
      const id = `approval-${name}-${Date.now()}`;
      setTrajectory((t) => [
        ...t,
        { kind: "tool_use", name, input, id },
        { kind: "tool_result", id, output },
      ]);
    },
    []
  );

  return { messages, trajectory, loading, send, recordExternalToolCall };
}
