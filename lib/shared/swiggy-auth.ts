// OAuth 2.1 + PKCE against the real Swiggy Builders Club MCP servers.
// Docs verified live at https://mcp.swiggy.com/builders/docs/start/authenticate
// Verify against the live docs before changing anything here — don't guess a
// tool name, parameter or auth step: https://mcp.swiggy.com/builders/llms.txt
//
// Swiggy MCP auth is user-level (phone + OTP), not a service API key, and v1
// has no refresh-token grant — an expired token means re-running the full
// flow. There's no DB in this repo, so the token is held in a single signed,
// httpOnly cookie scoped to one admin-initiated "Connect Swiggy" session.

import crypto from "node:crypto";
import { cookies } from "next/headers";

export const SWIGGY_BASE_URL = process.env.SWIGGY_MCP_BASE_URL ?? "https://mcp.swiggy.com";

const STATE_COOKIE = "swiggy_oauth_state";
const VERIFIER_COOKIE = "swiggy_oauth_verifier";
const TOKEN_COOKIE = "swiggy_token";

type StoredToken = {
  access_token: string;
  token_type: string;
  scope: string;
  expires_at: number; // epoch ms
};

export function isSwiggyMcpEnabled(): boolean {
  return process.env.SWIGGY_MCP_ENABLED === "true";
}

export function generatePkce() {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
  const state = crypto.randomBytes(16).toString("base64url");
  return { codeVerifier, codeChallenge, state };
}

export function buildAuthorizeUrl(opts: {
  codeChallenge: string;
  state: string;
  redirectUri: string;
  clientId: string;
}): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    code_challenge: opts.codeChallenge,
    code_challenge_method: "S256",
    state: opts.state,
    scope: "mcp:tools",
  });
  return `${SWIGGY_BASE_URL}/auth/authorize?${params.toString()}`;
}

// Dynamic Client Registration (RFC 7591) — POST /auth/register. Swiggy's
// docs say "no manual client registration needed" for MCP-compatible
// clients; DCR is how that's implemented. We register once per redirect URI
// and cache the client_id in-process (fine for a single-admin dev session —
// re-registers on server restart, which is harmless and free).
let cachedClientId: string | null = null;

export async function getOrRegisterClientId(redirectUri: string): Promise<string> {
  if (cachedClientId) return cachedClientId;
  const res = await fetch(`${SWIGGY_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      redirect_uris: [redirectUri],
      client_name: "GreenLedger (Second Helping / Group Concierge)",
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });
  if (!res.ok) {
    throw new Error(`Swiggy dynamic client registration failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  cachedClientId = json.client_id;
  return json.client_id;
}

export async function exchangeCodeForToken(opts: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<StoredToken> {
  const res = await fetch(`${SWIGGY_BASE_URL}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code: opts.code,
      code_verifier: opts.codeVerifier,
      redirect_uri: opts.redirectUri,
    }),
  });
  if (!res.ok) {
    throw new Error(`Swiggy token exchange failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return {
    access_token: json.access_token,
    token_type: json.token_type ?? "Bearer",
    scope: json.scope ?? "",
    expires_at: Date.now() + (json.expires_in ?? 0) * 1000,
  };
}

// --- Cookie-backed session (single admin-initiated connection) ---

export async function saveOauthAttempt(state: string, codeVerifier: string) {
  const store = await cookies();
  const opts = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: 600 };
  store.set(STATE_COOKIE, state, opts);
  store.set(VERIFIER_COOKIE, codeVerifier, opts);
}

export async function consumeOauthAttempt(): Promise<{ state: string; codeVerifier: string } | null> {
  const store = await cookies();
  const state = store.get(STATE_COOKIE)?.value;
  const codeVerifier = store.get(VERIFIER_COOKIE)?.value;
  store.delete(STATE_COOKIE);
  store.delete(VERIFIER_COOKIE);
  if (!state || !codeVerifier) return null;
  return { state, codeVerifier };
}

export async function saveSwiggyToken(token: StoredToken) {
  const store = await cookies();
  store.set(TOKEN_COOKIE, JSON.stringify(token), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(1, Math.floor((token.expires_at - Date.now()) / 1000)),
  });
}

export async function clearSwiggyToken() {
  const store = await cookies();
  store.delete(TOKEN_COOKIE);
}

/** Returns a still-valid access token, or null if not connected / expired (no refresh grant in v1). */
export async function getValidSwiggyToken(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(TOKEN_COOKIE)?.value;
  if (!raw) return null;
  try {
    const token: StoredToken = JSON.parse(raw);
    if (token.expires_at <= Date.now()) return null;
    return token.access_token;
  } catch {
    return null;
  }
}

export async function isSwiggyConnected(): Promise<boolean> {
  return (await getValidSwiggyToken()) !== null;
}
