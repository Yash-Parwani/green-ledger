"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAgentChat } from "@/lib/shared/useAgentChat";
import { ModeSwitch, type ConsoleMode } from "@/components/console/ModeSwitch";
import { CsrConsole } from "@/components/console/CsrConsole";
import { CommunityConsole } from "@/components/console/CommunityConsole";
import { SwiggyConnect } from "@/components/console/SwiggyConnect";

function ModeFromQuery({ onMode }: { onMode: (m: ConsoleMode) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const requested = searchParams.get("mode");
    if (requested === "community" || requested === "csr") onMode(requested);
  }, [searchParams, onMode]);
  return null;
}

export default function ConsolePage() {
  const [mode, setMode] = useState<ConsoleMode>("csr");

  // Both chats are instantiated unconditionally so switching modes never loses progress.
  const csrChat = useAgentChat("/api/second-helping/chat");
  const communityChat = useAgentChat("/api/group-concierge/chat");

  return (
    <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8">
      <Suspense fallback={null}>
        <ModeFromQuery onMode={setMode} />
      </Suspense>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-ink-500">
          One ledger, two modes — CSR programs are the default, community events are one tap away.
        </p>
        <div className="flex items-center gap-4">
          <SwiggyConnect />
          <ModeSwitch mode={mode} onChange={setMode} />
        </div>
      </div>

      {mode === "csr" ? <CsrConsole chat={csrChat} /> : <CommunityConsole chat={communityChat} />}
    </div>
  );
}
