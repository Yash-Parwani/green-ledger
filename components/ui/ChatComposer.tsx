"use client";

import { useState } from "react";
import { Button } from "./Button";
import { VoiceInputButton } from "./VoiceInputButton";
import { ImageUpload } from "./ImageUpload";

export function ChatComposer({
  value,
  onChange,
  onSend,
  loading,
  placeholder,
  sendLabel = "Send",
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: (text: string) => void;
  loading: boolean;
  placeholder: string;
  sendLabel?: string;
}) {
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setParseError(null);
    setParsing(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/parse-brief", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not read that file");
      if (data.text) onChange(data.text);
    } catch (e) {
      setParseError((e as Error).message);
    } finally {
      setParsing(false);
    }
  }

  return (
    <div>
      {parseError && (
        <p role="alert" className="mb-1.5 px-1 text-xs text-red-600">
          {parseError}
        </p>
      )}
      {parsing && (
        <p role="status" className="mb-1.5 px-1 text-xs italic text-ink-500">
          Reading your upload…
        </p>
      )}
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSend(value);
        }}
      >
        <ImageUpload onFile={handleFile} disabled={loading || parsing} />
        <VoiceInputButton onTranscript={(t) => onChange(t)} disabled={loading} />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={loading}
          className="flex-1 rounded-full border border-ink-200 bg-white px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-orange-400 disabled:opacity-60"
        />
        <Button type="submit" disabled={loading || !value.trim()} size="md">
          {sendLabel}
        </Button>
      </form>
    </div>
  );
}
