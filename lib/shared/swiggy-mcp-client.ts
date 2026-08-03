// Generic client for the real Swiggy Builders Club MCP servers (Food,
// Instamart, Dineout). Confirmed live against the docs: standard MCP
// Streamable HTTP transport, JSON-RPC 2.0 `tools/call`, response envelope
// `{success, data, message}` / `{success:false, error:{message}}`.
// Verify against the live docs before changing this — mount paths and tool
// signatures are easy to get wrong: https://mcp.swiggy.com/builders/llms.txt

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SWIGGY_BASE_URL } from "./swiggy-auth";

export type SwiggyServer = "food" | "instamart" | "dineout";

/**
 * Mount path per server — NOT the same as the server name. Instamart is served
 * at `/im`, not `/instamart`. Confirmed 2026-08-02 against llms-full.txt: 48
 * occurrences of `mcp.swiggy.com/im`, zero of `mcp.swiggy.com/instamart`.
 * Every path returns 401 from the edge auth gate (including bogus ones), so a
 * wrong path fails as an auth error and is easy to misdiagnose — don't
 * "simplify" this back to `/${server}`.
 */
const SERVER_PATH: Record<SwiggyServer, string> = {
  food: "food",
  instamart: "im",
  dineout: "dineout",
};

export class SwiggyMcpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SwiggyMcpError";
  }
}

/**
 * Calls a single real Swiggy MCP tool and returns its full response envelope
 * (not just `.data` — a few tools like get_available_slots/get_booking_status
 * put the payload under `slots`/`order`/`cart` at the top level instead of
 * `data`, confirmed per-tool against the live docs). Throws SwiggyMcpError on
 * any failure — callers should catch this and return an `ok:false` tool
 * result, never let it surface to the chat loop.
 */
const TOOL_CALL_TIMEOUT_MS = 12_000;
/** Hard cap on any upstream error text we log or wrap — Swiggy occasionally
 * returns a full HTML error page (multi-KB) instead of JSON on an outage;
 * without a cap that text gets embedded and re-wrapped at every catch layer
 * and can balloon into a multi-MB response that stalls the client fetch. */
const MAX_ERROR_TEXT = 300;

function truncate(s: string, max = MAX_ERROR_TEXT): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export async function callSwiggyTool(
  server: SwiggyServer,
  toolName: string,
  args: Record<string, unknown>,
  accessToken: string
): Promise<Record<string, unknown>> {
  const transport = new StreamableHTTPClientTransport(new URL(`${SWIGGY_BASE_URL}/${SERVER_PATH[server]}`), {
    requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const client = new Client({ name: "greenledger", version: "0.1.0" });

  try {
    await client.connect(transport);
    const result = await client.callTool(
      { name: toolName, arguments: args },
      undefined,
      { timeout: TOOL_CALL_TIMEOUT_MS }
    );
    const envelope = extractEnvelope(result);
    if (!envelope) {
      if (process.env.NODE_ENV !== "production") {
        console.error(`[swiggy-mcp:debug] ${toolName} unrecognized response shape:`, truncate(JSON.stringify(result)));
      }
      throw new SwiggyMcpError(`${toolName}: unrecognized response shape`);
    }
    if (envelope.success === false) {
      throw new SwiggyMcpError(truncate(normalizeError(envelope) ?? `${toolName} failed`));
    }
    return envelope;
  } catch (err) {
    if (err instanceof SwiggyMcpError) throw err;
    throw new SwiggyMcpError(`Swiggy ${server}.${toolName} call failed: ${truncate((err as Error).message ?? String(err))}`);
  } finally {
    await client.close().catch(() => {});
  }
}

/**
 * Live Swiggy MCP responses put the actual payload in the standard MCP
 * `structuredContent` field (confirmed against real traffic) — `content` is
 * a human-readable text summary, not JSON to parse. `structuredContent`
 * itself IS the per-tool payload the docs describe (e.g. `{addresses:[...]}`
 * for get_addresses, or top-level `{slots:[...]}` for get_available_slots),
 * so we both spread it at the top level (for the few tools callers read
 * top-level fields from) and mirror it under `.data` (for the majority that
 * read `res.data`).
 */
function extractEnvelope(result: unknown): Record<string, unknown> | null {
  if (!result || typeof result !== "object") return null;
  const r = result as { content?: unknown; structuredContent?: unknown; isError?: boolean };

  if (r.isError) {
    return { success: false, error: { message: textSummary(r.content) ?? "Swiggy MCP call failed" } };
  }

  // An EMPTY structuredContent must not short-circuit the text fallback:
  // dineout's search_restaurants_dineout returns `structuredContent: {}` on
  // success with the actual results only in the prose text block (confirmed
  // live 2026-08-02). Treating `{}` as a valid payload silently yielded zero
  // results with ok:true.
  if (r.structuredContent && typeof r.structuredContent === "object") {
    const sc = r.structuredContent as Record<string, unknown>;
    if (Object.keys(sc).length > 0) {
      return { success: true, ...sc, data: sc.data ?? sc };
    }
  }

  // Fallback: instamart's search_products embeds the full JSON envelope in
  // the text block instead of structuredContent.
  const text = textSummary(r.content);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // Not JSON — a prose-only tool (dineout search). Hand the raw text back
    // so callers that know how to read it can, instead of erroring out.
    return { success: true, data: {}, text };
  }
}

/**
 * Parse dineout's prose-only restaurant list.
 *
 * `search_restaurants_dineout` returns `structuredContent: {}` on success —
 * unlike Food's `search_restaurants` (which returns `restaurants[]`) and
 * Instamart's `search_products` (JSON in the text block). The only machine-
 * readable handle is the trailing `(ID: n)` on each line, so we parse it.
 * Confirmed against live traffic 2026-08-02; delete this once Swiggy
 * populates structuredContent for this tool.
 *
 * Line format: `1. Bangalore Brew Works — | 4.2★ | | Residency Road (ID: 823344)`
 */
export function parseDineoutRestaurantText(text: string): {
  id: string;
  name: string;
  rating: number | null;
  area: string | null;
}[] {
  const out: { id: string; name: string; rating: number | null; area: string | null }[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*\d+\.\s*(.+?)\s*\(ID:\s*(\d+)\)\s*$/);
    if (!m) continue;
    const [, body, id] = m;
    const parts = body.split("—");
    const name = (parts[0] ?? "").trim();
    const rest = parts.slice(1).join("—");
    const rating = rest.match(/([\d.]+)★/);
    const segments = rest.split("|").map((s) => s.trim()).filter(Boolean);
    const area = segments.filter((s) => !s.includes("★")).pop() ?? null;
    if (name && id) {
      out.push({ id, name, rating: rating ? Number(rating[1]) : null, area });
    }
  }
  return out;
}

function textSummary(content: unknown): string | null {
  if (!Array.isArray(content)) return null;
  const textBlock = content.find((c) => c && typeof c === "object" && "text" in c) as
    | { text?: string }
    | undefined;
  return textBlock?.text ?? null;
}

/** `error` is a string on some tools (get_available_slots, book_table) and `{message}` on others. */
function normalizeError(envelope: Record<string, unknown>): string | null {
  const error = envelope.error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return null;
}

// --- Address resolution helpers ---
// Real orders need a real addressId/locationId from the connected account
// (get_addresses / get_saved_locations) — a free-text `location` string from
// the user is not one. Both endpoints return records shaped
// `{id, addressLine, addressCategory, addressTag, ...}` (confirmed against
// live traffic). When the caller has a location hint from the user's actual
// request (e.g. "near Bangalore"), match it against `addressLine` so we
// search around the city the user asked about, not just whichever saved
// address happens to be first — falling back to the first saved address
// only when there's no hint or nothing matches. Each throws SwiggyMcpError
// if the account has no saved addresses at all; callers surface that as an
// honest tool error rather than guessing an address.

type SavedAddress = { id?: string; addressId?: string; addressLine?: string };

// Colloquial/former names still commonly used for Indian cities, so a query
// for "Bangalore" matches a saved address written as "Bengaluru" and vice
// versa. Each group is tried against the address text as alternatives.
const CITY_ALIASES: string[][] = [
  ["bangalore", "bengaluru"],
  ["bombay", "mumbai"],
  ["calcutta", "kolkata"],
  ["madras", "chennai"],
  ["gurgaon", "gurugram"],
  ["pondicherry", "puducherry"],
  ["baroda", "vadodara"],
  ["mysore", "mysuru"],
];

function pickAddress(list: SavedAddress[], locationHint?: string): SavedAddress | undefined {
  if (locationHint) {
    // The hint may be a full phrase ("near Bangalore", "Whitefield, Bangalore")
    // rather than a bare city name, so try each word (and its city aliases)
    // as an independent candidate rather than matching the whole phrase.
    const words = locationHint.toLowerCase().match(/[a-z]+/g) ?? [];
    const candidates = new Set<string>();
    for (const w of words) {
      if (w.length < 3) continue;
      candidates.add(w);
      const group = CITY_ALIASES.find((g) => g.includes(w));
      group?.forEach((alias) => candidates.add(alias));
    }
    const match = list.find((a) => {
      const line = a.addressLine?.toLowerCase() ?? "";
      return [...candidates].some((c) => line.includes(c));
    });
    if (match) return match;
  }
  return list[0];
}

export async function resolveFoodOrInstamartAddressId(
  server: "food" | "instamart",
  accessToken: string,
  locationHint?: string
): Promise<string> {
  const res = await callSwiggyTool(server, "get_addresses", {}, accessToken);
  const raw = res.data;
  const list = (Array.isArray(raw)
    ? raw
    : ((raw as { addresses?: unknown[] } | undefined)?.addresses ?? [])) as SavedAddress[];
  const picked = pickAddress(list, locationHint);
  const addressId = picked?.addressId ?? picked?.id;
  if (!addressId) throw new SwiggyMcpError(`No saved ${server} addresses on the connected account`);
  return addressId;
}

export async function resolveDineoutLocationId(accessToken: string, locationHint?: string): Promise<string> {
  const res = await callSwiggyTool("dineout", "get_saved_locations", {}, accessToken);
  const list = ((res.data as { locations?: SavedAddress[] } | undefined)?.locations ?? []);
  const picked = pickAddress(list, locationHint);
  const id = picked?.id;
  if (!id) throw new SwiggyMcpError("No saved Dineout locations on the connected account");
  return id;
}
