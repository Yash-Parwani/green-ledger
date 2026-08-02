"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/shared/cn";

// Minimal shape of the (still non-standard) Web Speech API we need.
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
}

export function VoiceInputButton({
  onTranscript,
  disabled,
}: {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Impl = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Impl) {
      setSupported(false);
      return;
    }
    const recognition = new Impl();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-IN";
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) onTranscript(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
  }, [onTranscript]);

  if (!supported) return null;

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={listening}
      aria-label={listening ? "Stop voice input" : "Speak your brief instead of typing"}
      onClick={() => {
        if (!recognitionRef.current) return;
        if (listening) {
          recognitionRef.current.stop();
          setListening(false);
        } else {
          recognitionRef.current.start();
          setListening(true);
        }
      }}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors",
        listening
          ? "border-orange-500 bg-orange-500 text-white"
          : "border-ink-200 bg-white text-ink-500 hover:border-orange-300 hover:text-orange-600"
      )}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden>
        <path
          d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path d="M19 11a7 7 0 0 1-14 0M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      {listening && <span className="sr-only">Listening…</span>}
    </button>
  );
}
