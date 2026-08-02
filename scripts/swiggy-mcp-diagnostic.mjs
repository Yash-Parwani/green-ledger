#!/usr/bin/env node
/**
 * Swiggy MCP endpoint diagnostic — produces a request/response evidence log.
 *
 * READ-ONLY. This script calls only discovery/read tools (tools/list,
 * get_addresses, search_products, search_restaurants, search_menu,
 * get_saved_locations, search_restaurants_dineout). It NEVER calls
 * update_cart, update_food_cart, checkout, place_food_order, confirm_order,
 * book_table, or any other tool that mutates state or spends money.
 *
 * Usage:
 *   SWIGGY_TOKEN='<access token>' node scripts/swiggy-mcp-diagnostic.mjs
 *
 * Get the token: start the app, click "Connect Swiggy account", complete the
 * phone+OTP flow, then in DevTools > Application > Cookies copy the
 * `swiggy_token` cookie value and pull out its `access_token` field.
 *
 * Output: scripts/swiggy-mcp-report.md  (paste-ready for builders@swiggy.in)
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = process.env.SWIGGY_MCP_BASE_URL ?? "https://mcp.swiggy.com";
const TOKEN = process.env.SWIGGY_TOKEN;
const TIMEOUT_MS = 20_000;

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "swiggy-mcp-report.md");

if (!TOKEN) {
  console.error("SWIGGY_TOKEN is not set. See the header of this file for how to get one.");
  process.exit(1);
}

const log = [];
let rpcId = 1;

/** Raw JSON-RPC over Streamable HTTP — deliberately not the MCP SDK, so the
 *  report shows exactly what goes on the wire and what comes back. */
async function rpc(path, method, params, { withAuth = true, label } = {}) {
  const url = `${BASE}/${path}`;
  const body = { jsonrpc: "2.0", id: rpcId++, method, ...(params ? { params } : {}) };
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    ...(withAuth ? { Authorization: `Bearer ${TOKEN}` } : {}),
  };

  const started = Date.now();
  let status = null;
  let responseText = "";
  let error = null;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    status = res.status;
    responseText = await res.text();
  } catch (e) {
    error = e.message ?? String(e);
  }

  const ms = Date.now() - started;
  const entry = {
    label: label ?? `${path} · ${method}${params?.name ? ` · ${params.name}` : ""}`,
    url,
    request: { ...body, _headers: { ...headers, Authorization: withAuth ? "Bearer <redacted>" : undefined } },
    status,
    ms,
    error,
    response: responseText.slice(0, 4000),
  };
  log.push(entry);
  console.log(`[${status ?? "ERR"}] ${entry.label} (${ms}ms)`);
  return entry;
}

/** Streamable HTTP requires initialize before tools/call on a fresh session,
 *  so mirror what the SDK does: initialize -> notifications/initialized. */
async function session(path) {
  const init = await rpc(path, "initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "greenledger-diagnostic", version: "0.1.0" },
  }, { label: `${path} · initialize` });
  return init;
}

async function main() {
  console.log(`Base URL: ${BASE}\n`);

  // ── 1. Path check: is Instamart at /instamart or /im? ──────────────────
  console.log("── Path resolution ──");
  for (const path of ["food", "instamart", "im", "dineout"]) {
    await session(path);
  }

  // ── 2. Unauthenticated control, to show 401 is not a health signal ─────
  console.log("\n── Control: auth gate answers before routing ──");
  await rpc("totally-bogus-path-xyz123", "tools/list", null, {
    withAuth: false,
    label: "CONTROL · bogus path, no auth (expect 401, proving 401 ≠ 404)",
  });

  // ── 3. tools/list per server ───────────────────────────────────────────
  console.log("\n── tools/list ──");
  for (const path of ["food", "im", "dineout"]) {
    await rpc(path, "tools/list", null, { label: `${path} · tools/list` });
  }

  // ── 4. get_addresses — everything downstream needs a real addressId ────
  console.log("\n── get_addresses ──");
  const addrEntry = await rpc("food", "tools/call", {
    name: "get_addresses",
    arguments: {},
  });

  // Best-effort dig out an addressId so the search calls are realistic.
  let addressId = process.env.SWIGGY_ADDRESS_ID ?? null;
  if (!addressId && addrEntry.response) {
    const m = addrEntry.response.match(/"(?:addressId|id)"\s*:\s*"?([\w-]+)"?/);
    if (m) addressId = m[1];
  }
  console.log(`  addressId resolved: ${addressId ?? "NONE — searches will likely fail"}`);

  // ── 5. The two failing paths, with a real addressId ────────────────────
  console.log("\n── Instamart search_products (reported: always errors) ──");
  await rpc("im", "tools/call", {
    name: "search_products",
    arguments: { addressId, query: "rice" },
  });
  // Same call against the WRONG path, for side-by-side evidence.
  await rpc("instamart", "tools/call", {
    name: "search_products",
    arguments: { addressId, query: "rice" },
  }, { label: "instamart · search_products (WRONG PATH — for comparison)" });

  console.log("\n── Food search_restaurants + search_menu (reported: no real items) ──");
  const restEntry = await rpc("food", "tools/call", {
    name: "search_restaurants",
    arguments: { addressId, query: "north indian" },
  });

  let restaurantId = null;
  if (restEntry.response) {
    const m = restEntry.response.match(/"restaurantId"\s*:\s*"?(\d+)"?/) ??
              restEntry.response.match(/"id"\s*:\s*"?(\d{4,})"?/);
    if (m) restaurantId = m[1];
  }
  console.log(`  restaurantId resolved: ${restaurantId ?? "NONE"}`);

  await rpc("food", "tools/call", {
    name: "search_menu",
    arguments: { addressId, query: "dal", ...(restaurantId ? { restaurantIdOfAddedItem: restaurantId } : {}) },
  });

  // ── 6. Dineout, for completeness ───────────────────────────────────────
  console.log("\n── Dineout ──");
  await rpc("dineout", "tools/call", { name: "get_saved_locations", arguments: {} });

  writeReport();
}

function writeReport() {
  const now = new Date().toISOString();
  const lines = [
    `# Swiggy MCP endpoint diagnostic`,
    ``,
    `- **Run at:** ${now}`,
    `- **Base URL:** \`${BASE}\``,
    `- **Client:** raw JSON-RPC 2.0 over Streamable HTTP (not the MCP SDK, so this is exactly what goes on the wire)`,
    `- **Scope:** read-only tools only. No cart, checkout, order, or booking tool was called.`,
    ``,
    `## Summary`,
    ``,
    `| # | Call | HTTP | ms |`,
    `| --- | --- | --- | --- |`,
    ...log.map((e, i) => `| ${i + 1} | ${e.label} | ${e.status ?? `ERR: ${e.error}`} | ${e.ms} |`),
    ``,
    `## Full request / response log`,
    ``,
  ];

  for (const [i, e] of log.entries()) {
    lines.push(
      `### ${i + 1}. ${e.label}`,
      ``,
      `**POST** \`${e.url}\` → **HTTP ${e.status ?? "(transport error)"}** in ${e.ms}ms`,
      ``,
      e.error ? `**Transport error:** \`${e.error}\`\n` : ``,
      `Request:`,
      "```json",
      JSON.stringify(e.request, null, 2),
      "```",
      ``,
      `Response:`,
      "```",
      e.response || "(empty body)",
      "```",
      ``,
    );
  }

  writeFileSync(OUT, lines.join("\n"));
  console.log(`\nReport written to ${OUT}`);
}

main().catch((e) => {
  console.error("Diagnostic failed:", e);
  writeReport();
  process.exit(1);
});
