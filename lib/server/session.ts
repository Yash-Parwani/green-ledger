// Server-side session. This file exists to enforce one rule:
//
//   Tenant identity is issued by the server and read from a signed cookie.
//   It is never accepted from a request body, a query param, or a tool call.
//
// Before this existed, `corporate_id` was a free-text parameter on the CSR
// tool schemas — so the *language model* chose which tenant to read and write,
// and `POST /api/second-helping/chat` accepted the org's name AND annual budget
// straight off the request body. Any caller could read another org's budget by
// naming it, or inflate their own by declaring it. Persisting that shape into
// Postgres would only have made the bug durable.
//
// Keep org identity out of every tool schema. If a tool needs to know which
// organization it is acting for, it receives it through AgentContext, which is
// built here from the session and nowhere else.

import crypto from "node:crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE = "gl_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type Role = "csr_admin" | "approver" | "finance" | "viewer";

export type Session = {
  orgId: string;
  userId: string;
  role: Role;
  issuedAt: number;
};

/** What org-scoped tool implementations are allowed to know. Note there is no
 *  setter — a tool cannot change which organization it is acting for. */
export type AgentContext = {
  orgId: string;
  userId: string;
  role: Role;
};

// ─── Secret ───────────────────────────────────────────────────────────────────

// Pinned to globalThis, not a module-scoped `let`. Next.js re-evaluates this
// module on hot reload and evaluates it separately per route module graph — a
// module-scoped secret regenerates on both, silently invalidating every live
// session mid-development. Symptom is nasty to diagnose: the app looks like it
// forgot who you are for no reason, and different routes disagree about it.
const globalForSecret = globalThis as unknown as { __glDevSessionSecret?: string };

function secret(): string {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv && fromEnv.length >= 32) return fromEnv;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET is required in production and must be at least 32 characters. " +
        "Generate one with: openssl rand -base64 32"
    );
  }

  // Dev only. Still per-process, so sessions correctly drop on a real restart.
  if (!globalForSecret.__glDevSessionSecret) {
    globalForSecret.__glDevSessionSecret = crypto.randomBytes(32).toString("base64url");
    console.warn(
      "[session] SESSION_SECRET not set — using an ephemeral dev secret. " +
        "Sessions will not survive a server restart. Set SESSION_SECRET in .env."
    );
  }
  return globalForSecret.__glDevSessionSecret;
}

// ─── Signing ──────────────────────────────────────────────────────────────────

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(session: Session): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(raw: string): Session | null {
  const dot = raw.lastIndexOf(".");
  if (dot < 1) return null;
  const payload = raw.slice(0, dot);
  const provided = raw.slice(dot + 1);

  const expected = sign(payload);
  // Constant-time compare; bail on length mismatch first because
  // timingSafeEqual throws on unequal lengths.
  if (provided.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    if (!parsed?.orgId || !parsed?.userId || !parsed?.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getSession(): Promise<Session | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  return raw ? decode(raw) : null;
}

/**
 * Issue a session for a newly registered organization. The orgId is random and
 * server-generated — deliberately NOT a slug of the company name, because a
 * guessable tenant key is the thing that made the previous design exploitable.
 */
export async function createSession(opts: { role?: Role } = {}): Promise<Session> {
  const session: Session = {
    orgId: `org_${crypto.randomBytes(12).toString("base64url")}`,
    userId: `usr_${crypto.randomBytes(12).toString("base64url")}`,
    role: opts.role ?? "csr_admin",
    issuedAt: Date.now(),
  };

  (await cookies()).set(SESSION_COOKIE, encode(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });

  return session;
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export function toAgentContext(session: Session): AgentContext {
  return { orgId: session.orgId, userId: session.userId, role: session.role };
}
