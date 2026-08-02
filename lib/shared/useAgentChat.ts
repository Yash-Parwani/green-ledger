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

  return { messages, trajectory, loading, send };
}
