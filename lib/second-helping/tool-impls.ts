// Food/Instamart/Dineout search and order tools call the real Swiggy MCP
// servers only — no fabricated fallback data. If SWIGGY_MCP_ENABLED is off,
// no admin is connected, or the real call fails, these return an honest
// `ok:false` error instead of inventing restaurant names or prices. Connect
// via the "Connect Swiggy account" control in the console header.
//
// The "Our product layer" tools below (setup_csr_profile, csr_budget_status,
// schedule_program, generate_80g_receipt, generate_gst_invoice,
// impact_dashboard_update) stay simulated on purpose — they're GreenLedger's
// own business logic (recurrence scheduling, budget math, compliance docs),
// not stand-ins for external Swiggy facts, so there's no "real version" to
// swap them for.
//
// `instamart_schedule_recurring` / `food_schedule_meal_program` now build a
// REAL cart against live Swiggy MCP — real search_products/search_menu
// results, real prices, a real update_cart/update_food_cart call — and only
// stop short of the final checkout/place_food_order/confirm_order step
// (verified against https://mcp.swiggy.com/builders/docs/reference/{food,instamart}
// on 2026-08-02: neither has a dry-run mode, both capture real payment with
// no simulation flag, and place_food_order additionally hard-caps at ₹1000
// per order in production — well below CSR-scale volumes regardless, so a
// production rollout would go through Swiggy's enterprise/batch ordering
// path rather than this single-cart call anyway). That last step returns
// `payment_simulated: true` instead of actually charging anything.
// NOTE: search_menu/update_food_cart item shape (variations vs variantsV2)
// is runtime-dependent per Swiggy's own docs — this hasn't had a live smoke
// test against a connected account yet, only been verified against the docs
// (see CLAUDE.md's "how to verify the build").
//
// Real MCP endpoints:
//   Food:      POST mcp.swiggy.com/food
//   Instamart: POST mcp.swiggy.com/instamart
//   Dineout:   POST mcp.swiggy.com/dineout

import { isSwiggyMcpEnabled, getValidSwiggyToken } from "@/lib/shared/swiggy-auth";
import {
  callSwiggyTool,
  resolveFoodOrInstamartAddressId,
  resolveDineoutLocationId,
  parseDineoutRestaurantText,
} from "@/lib/shared/swiggy-mcp-client";
import { repo } from "@/lib/server/orgStore";
import { ngos } from "@/lib/server/ngoStore";
import { ledger } from "@/lib/server/ledger";
import { artifacts } from "@/lib/server/artifacts";
import { renderDocument, formatInr } from "@/lib/server/pdf";
import { buildGstInvoice, type GstInvoiceInput } from "@/lib/server/gstInvoice";
import { applyBestCouponAtCheckout } from "@/lib/shared/food-coupons";
import { withPolicy } from "@/lib/server/withPolicy";
import type { AgentContext } from "@/lib/server/session";

type ToolResult = { ok: true; data: unknown } | { ok: false; error: string };
const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));

// Real Instamart search_products shape, confirmed against live traffic
// 2026-08-02. Note `price` is an OBJECT, not a number, and the display field
// is `displayName`, not `name` — both were wrong here before and produced
// NaN cart totals.
type InstamartVariation = {
  spinId?: string;
  skuId?: string;
  quantityDescription?: string;
  price?: { mrp?: number; offerPrice?: number; unitLevelPrice?: string };
};
type InstamartProduct = {
  displayName?: string;
  brand?: string;
  inStock?: boolean;
  isAvail?: boolean;
  variations?: InstamartVariation[];
};

/** Payable price for a variation — offerPrice when discounted, else MRP. */
function variationPrice(v?: InstamartVariation): number | null {
  return v?.price?.offerPrice ?? v?.price?.mrp ?? null;
}

const NOT_CONNECTED: ToolResult = {
  ok: false,
  error: "Swiggy isn't connected — connect your Swiggy account (console header) to search real results.",
};

// Ids GreenLedger mints for its own records. They are references, not Swiggy
// order ids — no order exists behind them, because checkout is simulated.
const GREENLEDGER_REF = /^(FD-MP|IM-RC|PROG|FD-GRP|80G|GST)-\d+$/;

function isGreenLedgerReference(id: string): boolean {
  return GREENLEDGER_REF.test(id.trim());
}

const NO_REAL_ORDER_TO_TRACK: ToolResult = {
  ok: false,
  error:
    "There is no Swiggy order to track. That id is GreenLedger's own programme reference, and checkout is simulated in this build — the cart is real but no order was placed, so Swiggy has nothing to report on it. Say that plainly rather than describing it as a status that hasn't arrived yet: it will not arrive. Live tracking starts working once real order placement is enabled.",
};

async function realMcpToken(): Promise<string | null> {
  if (!isSwiggyMcpEnabled()) return null;
  return getValidSwiggyToken();
}

function callFailed(err: unknown): ToolResult {
  return { ok: false, error: `Couldn't reach Swiggy just now: ${(err as Error).message}` };
}

// ─── Instamart: search_products ──────────────────────────────────────────────
export async function instamart_search_bulk(input: {
  category: "rice" | "dal" | "oil" | "wheat" | "salt" | "spices";
  quantity_kg: number;
  location: string;
}): Promise<ToolResult> {
  const token = await realMcpToken();
  if (!token) return NOT_CONNECTED;
  try {
    const addressId = await resolveFoodOrInstamartAddressId("instamart", token, input.location);
    const res = await callSwiggyTool("instamart", "search_products", { addressId, query: input.category }, token);
    const products = ((res.data as { products?: unknown[] } | undefined)?.products ?? []) as InstamartProduct[];
    return {
      ok: true,
      data: {
        best_offers: products.slice(0, 4).map((p) => {
          const v = p.variations?.[0];
          return {
            vendor: p.brand ?? p.displayName ?? "Instamart",
            product: p.displayName ?? null,
            pack: v?.quantityDescription ?? null,
            price_inr: variationPrice(v),
            unit_price: v?.price?.unitLevelPrice ?? null,
            spin_id: v?.spinId ?? null,
            // Real Instamart doesn't expose a bulk-discount or ETA field on search —
            // those stay unset here rather than fabricated.
          };
        }),
        query: input,
        source: "real",
      },
    };
  } catch (err) {
    return callFailed(err);
  }
}

// ─── Instamart: search_products + update_cart (real cart, simulated checkout) ─
export async function instamart_schedule_recurring(input: {
  items: { category: string; quantity_kg: number }[];
  delivery_address: string;
  cadence: "weekly" | "biweekly" | "monthly";
  weeks: number;
  ngo_name: string;
}): Promise<ToolResult> {
  const token = await realMcpToken();
  if (!token) return NOT_CONNECTED;
  try {
    const addressId = await resolveFoodOrInstamartAddressId("instamart", token, input.delivery_address);

    type CartItem = { spinId: string; skuId?: string; quantity: number };
    const cartItems: CartItem[] = [];
    const lineSummary: {
      category: string;
      vendor?: string;
      product?: string;
      pack_size: string;
      packs_ordered: number;
      price_per_pack_inr: number;
      unit_price?: string;
    }[] = [];
    let perDropTotal = 0;

    for (const item of input.items) {
      const res = await callSwiggyTool("instamart", "search_products", { addressId, query: item.category }, token);
      const products = ((res.data as { products?: unknown[] } | undefined)?.products ?? []) as InstamartProduct[];
      const top = products.find((p) => p.inStock !== false && p.isAvail !== false) ?? products[0];
      const variation = top?.variations?.[0];
      const price = variationPrice(variation);
      if (!top || !variation?.spinId || price == null) continue;
      // `quantity` is packs of `quantityDescription`, NOT kilograms — Instamart
      // has no per-kg ordering. We can't convert without parsing the pack size,
      // so order one pack per requested kg and report the pack size so the
      // agent (and the user) can see the real quantity being bought.
      cartItems.push({ spinId: variation.spinId, skuId: variation.skuId, quantity: item.quantity_kg });
      perDropTotal += price * item.quantity_kg;
      lineSummary.push({
        category: item.category,
        vendor: top.brand ?? top.displayName,
        product: top.displayName,
        pack_size: variation.quantityDescription ?? "unknown",
        packs_ordered: item.quantity_kg,
        price_per_pack_inr: price,
        unit_price: variation.price?.unitLevelPrice,
      });
    }

    if (cartItems.length === 0) {
      return { ok: false, error: `None of the requested staple categories matched real Instamart products near ${input.delivery_address} — try different categories.` };
    }

    await callSwiggyTool("instamart", "update_cart", { selectedAddressId: addressId, items: cartItems }, token);

    const cadenceMultiplier = { weekly: 1, biweekly: 0.5, monthly: 0.25 }[input.cadence] ?? 1;
    const totalDrops = Math.ceil(input.weeks * cadenceMultiplier);
    return {
      ok: true,
      data: {
        schedule_id: `IM-RC-${Date.now()}`,
        id_type: "greenledger_reference",
        swiggy_order_id: null,
        ngo: input.ngo_name,

        // One drop ordered; the rest scheduled. Same reasoning as the Food
        // programme — the cart holds a single drop, and staple prices move, so
        // each drop is re-priced and re-confirmed rather than locked in today.
        drop_placed: 1,
        this_drop_inr: Math.round(perDropTotal),
        items: lineSummary,
        next_delivery: getNextSaturday(),

        drops_total: totalDrops,
        drops_remaining: Math.max(totalDrops - 1, 0),
        next_drop_due: totalDrops > 1 ? nextDropDue(input.cadence) : null,
        programme_value_inr: Math.round(perDropTotal * totalDrops),
        remaining_drops_note:
          totalDrops > 1
            ? `Drops 2-${totalDrops} are scheduled, not ordered. Each is re-priced against live Instamart and confirmed with the CSR admin before it runs.`
            : "Single drop — nothing further scheduled.",
        scheduler_status: "not_yet_running",
        scheduler_note:
          "The recurring runner isn't live in this build, so drops 2+ won't fire on their own yet. Say so if asked.",
        cadence: input.cadence,
        payment_simulated: true,
        payment_note:
          "Cart built against live Swiggy Instamart MCP — real products, real prices. Checkout/payment capture is simulated in this demo build; goes live on production once GreenLedger has approved payment credentials.",
        source: "real+simulated",
      },
    };
  } catch (err) {
    return callFailed(err);
  }
}

// ─── Instamart: track_order ──────────────────────────────────────────────────
export async function track_instamart_order(input: {
  schedule_id: string;
  latitude?: number;
  longitude?: number;
}): Promise<ToolResult> {
  const token = await realMcpToken();
  if (!token) return NOT_CONNECTED;
  if (input.latitude == null || input.longitude == null) {
    return {
      ok: false,
      error: "Live order tracking needs the delivery location's coordinates, which aren't available in this flow yet.",
    };
  }
  // Same as track_food_order: a schedule reference is not a Swiggy order id.
  if (isGreenLedgerReference(input.schedule_id)) return NO_REAL_ORDER_TO_TRACK;

  try {
    const res = await callSwiggyTool(
      "instamart",
      "track_order",
      { orderId: input.schedule_id, lat: input.latitude, lng: input.longitude },
      token
    );
    return { ok: true, data: { ...(res.data as object), swiggy_order_id: input.schedule_id, source: "real" } };
  } catch (err) {
    return callFailed(err);
  }
}

// ─── Food: search_restaurants ────────────────────────────────────────────────
export async function food_partner_kitchens(input: {
  // The NGO's actual delivery address, not a city name. Swiggy resolves
  // availability and delivery radius from this, so searching on "Pune" and
  // then delivering to Yerawada can surface kitchens that don't deliver there.
  // Ask the user for the address before searching rather than after.
  delivery_address: string;
  meal_type: "north_indian" | "south_indian" | "khichdi" | "biryani";
  servings: number;
  dietary?: string[];
}): Promise<ToolResult> {
  const token = await realMcpToken();
  if (!token) return NOT_CONNECTED;
  try {
    const addressId = await resolveFoodOrInstamartAddressId("food", token, input.delivery_address);
    const query = input.meal_type.replace("_", " ");
    const res = await callSwiggyTool("food", "search_restaurants", { addressId, query }, token);
    const data = res.data as { restaurants?: unknown[]; results?: unknown[] } | undefined;
    const results = (data?.restaurants ?? data?.results ?? []) as {
      id?: string;
      restaurantId?: string;
      name?: string;
      availabilityStatus?: string;
    }[];
    const open = results.filter((r) => r.availabilityStatus !== "CLOSED");
    return {
      ok: true,
      data: {
        kitchens: open.slice(0, 5).map((r) => ({
          id: r.restaurantId ?? r.id,
          name: r.name,
          // No FSSAI field. Swiggy's search_restaurants doesn't expose licence
          // status, so we used to return `certified_fssai: null` and the card
          // rendered "FSSAI status unverified" against every kitchen — which
          // manufactures doubt about every vendor while conveying nothing.
          // A compliance field we can never populate is worse than no field.
          // If Swiggy exposes it, add it back as a real value, never as a
          // permanent "unverified".
          dietary_compliance: input.dietary ?? [],
        })),
        query: input,
        source: "real",
      },
    };
  } catch (err) {
    return callFailed(err);
  }
}

// ─── Food: menu resolution ────────────────────────────────────────────────────
//
// Shared by the read-only quote and the cart builder, deliberately. If the
// quote resolved dishes differently from the cart, the prices shown to the
// customer before approval wouldn't be the prices actually ordered — and the
// whole point of quoting first is that the approved figures are the real ones.
// Change matching here or in neither place.

type ResolvedMenu = {
  cartItems: Record<string, unknown>[];
  menuSummary: { name: string; quantity: number; price_inr: number; line_total_inr: number }[];
  unmatched: string[];
  perDropTotal: number;
  kitchenName?: string;
};

async function resolveMenuSelection(
  token: string,
  addressId: string,
  kitchenId: string,
  picks: { query: string; quantity: number }[],
  dietaryNotes?: string
): Promise<ResolvedMenu> {
  const cartItems: Record<string, unknown>[] = [];
  const menuSummary: ResolvedMenu["menuSummary"] = [];
  const unmatched: string[] = [];
  let perDropTotal = 0;
  let kitchenName: string | undefined;

  // Live search_menu returns non-veg items for neutral queries (a "rice"
  // search at a veg program returned chicken biryani), so a veg program MUST
  // pass vegFilter:1 — serving non-veg to a shelter that asked for veg is a
  // program-ending failure, not a cosmetic one.
  const vegOnly = /\bveg\b|vegetarian|jain|no.?onion|satvik/i.test(dietaryNotes ?? "");

  for (const pick of picks) {
    const res = await callSwiggyTool(
      "food",
      "search_menu",
      {
        addressId,
        query: pick.query,
        restaurantIdOfAddedItem: kitchenId,
        ...(vegOnly ? { vegFilter: 1 } : {}),
      },
      token
    );
    const items = ((res.data as { items?: Record<string, unknown>[] } | undefined)?.items ??
      []) as Record<string, unknown>[];
    // Only order what's actually in stock at this kitchen. Live search_menu
    // items carry `inStock` (1/0) and `restaurant_id`; search can return items
    // from other restaurants even when scoped, and a cart may only contain
    // items from one restaurant.
    const match = items.find(
      (i) => i.inStock !== 0 && String(i.restaurant_id ?? kitchenId) === String(kitchenId)
    );
    const price = typeof match?.price === "number" ? (match.price as number) : 0;
    if (!match || !price) {
      // Never cost a line we couldn't price. Surfaced to the caller so the
      // agent reports a short plate instead of silently quoting for less food.
      unmatched.push(pick.query);
      continue;
    }
    kitchenName ??= match.restaurant_name as string | undefined;
    perDropTotal += price * pick.quantity;
    // Live search_menu items have `menu_item_id` and `hasVariants:false` — NOT
    // the `variations`/`variantsV2` the docs describe. Swiggy does not document
    // the cartItems element shape, so send the identifying fields explicitly
    // rather than spreading the whole search result.
    cartItems.push({
      menu_item_id: match.menu_item_id,
      quantity: pick.quantity,
      ...(match.hasVariants ? { variations: match.variations, variantsV2: match.variantsV2 } : {}),
    });
    menuSummary.push({
      name: (match.name as string) ?? pick.query,
      quantity: pick.quantity,
      price_inr: price,
      line_total_inr: price * pick.quantity,
    });
  }

  return { cartItems, menuSummary, unmatched, perDropTotal, kitchenName };
}

// ─── Food: read-only menu quote ───────────────────────────────────────────────
//
// READ-ONLY. Builds nothing, registers nothing, commits nothing — so it is not
// in COMMITTING_TOOLS and needs no approval.
//
// This exists because `search_menu` used to be reachable only through
// food_schedule_meal_program, which registers a recurrence. That left the agent
// genuinely unable to show a customer real dish prices without committing
// spend, so it either guessed a plate or ran a committing call as a price
// probe. Both are bad: the first quotes numbers no vendor gave, the second
// commits before anyone has seen a price.
export async function food_menu_quote(input: {
  kitchen_id: string;
  menu_items: { query: string; quantity: number }[];
  delivery_address: string;
  dietary_notes?: string;
  drops?: number;
}): Promise<ToolResult> {
  const token = await realMcpToken();
  if (!token) return NOT_CONNECTED;
  try {
    const addressId = await resolveFoodOrInstamartAddressId("food", token, input.delivery_address);
    const resolved = await resolveMenuSelection(
      token,
      addressId,
      input.kitchen_id,
      input.menu_items,
      input.dietary_notes
    );

    if (resolved.menuSummary.length === 0) {
      return {
        ok: false,
        error: `None of the requested dishes matched this kitchen's live menu (${input.menu_items
          .map((i) => i.query)
          .join(", ")}). Try different dish names.`,
      };
    }

    const drops = input.drops && input.drops > 0 ? input.drops : null;
    return {
      ok: true,
      data: {
        kitchen: resolved.kitchenName ?? input.kitchen_id,
        kitchen_id: input.kitchen_id,
        menu: resolved.menuSummary,
        unmatched_items: resolved.unmatched,
        per_drop_inr: Math.round(resolved.perDropTotal),
        ...(drops
          ? { drops, total_program_inr: Math.round(resolved.perDropTotal * drops) }
          : {}),
        dietary_filter_applied: /\bveg\b|vegetarian|jain|no.?onion|satvik/i.test(
          input.dietary_notes ?? ""
        )
          ? "veg only"
          : "none",
        quote_note:
          "Live prices from this kitchen's real menu. Nothing has been ordered, carted or scheduled — this is a quote. Prices can move between now and execution.",
        source: "real",
      },
    };
  } catch (err) {
    return callFailed(err);
  }
}

// ─── Food: search_menu + update_food_cart (real cart, simulated checkout) ────
export async function food_schedule_meal_program(input: {
  kitchen_id: string;
  menu_items: { query: string; quantity: number }[];
  servings_per_drop: number;
  delivery_address: string;
  cadence: "daily" | "weekly";
  weeks: number;
  ngo_name: string;
  dietary_notes?: string;
}): Promise<ToolResult> {
  const token = await realMcpToken();
  if (!token) return NOT_CONNECTED;
  try {
    const addressId = await resolveFoodOrInstamartAddressId("food", token, input.delivery_address);
    const { cartItems, menuSummary, unmatched, perDropTotal, kitchenName } =
      await resolveMenuSelection(
        token,
        addressId,
        input.kitchen_id,
        input.menu_items,
        input.dietary_notes
      );

    if (cartItems.length === 0) {
      return { ok: false, error: `None of the requested dishes matched this kitchen's real menu — try different dish names.` };
    }

    await callSwiggyTool(
      "food",
      "update_food_cart",
      {
        restaurantId: input.kitchen_id,
        cartItems,
        addressId,
        // The kitchen we're ordering FROM — not the NGO we're delivering to.
        // This was passing ngo_name, which mislabels the cart widget.
        restaurantName: kitchenName,
      },
      token
    );

    // Cart is built; this is the checkout moment, so it's the only point where
    // a coupon lookup is both valid (Swiggy scopes it to the cart stage) and
    // useful. Runs once, never throws, and never reports zero when it means
    // unknown. See lib/shared/food-coupons.ts.
    const coupon = await applyBestCouponAtCheckout({
      token,
      restaurantId: input.kitchen_id,
      addressId,
    });

    const dropsPerWeek = input.cadence === "daily" ? 7 : 1;
    const totalDrops = input.weeks * dropsPerWeek;
    const totalMeals = input.servings_per_drop * totalDrops;
    const perDropNet =
      coupon.savings_inr !== null ? Math.max(perDropTotal - coupon.savings_inr, 0) : null;
    return {
      ok: true,
      data: {
        program_id: `FD-MP-${Date.now()}`,
        // GreenLedger's reference for its own records. Not a Swiggy order id —
        // no order exists, and nothing can be tracked against this.
        id_type: "greenledger_reference",
        swiggy_order_id: null,
        ngo: input.ngo_name,

        // ONE DROP IS PLACED. The cart built above holds a single drop's
        // quantities, so that's all that has been ordered — the rest of the
        // programme is scheduled, not bought.
        //
        // This isn't only bookkeeping. A dish quoted today can be off the menu
        // by the next drop (already observed live), so committing ten drops at
        // today's price would lock in a number that stops being true almost
        // immediately. Each drop gets re-quoted and re-confirmed on its own.
        drop_placed: 1,
        this_drop_inr: Math.round(perDropTotal),
        ...(perDropNet !== null ? { this_drop_after_coupon_inr: Math.round(perDropNet) } : {}),
        menu: menuSummary,
        unmatched_items: unmatched,
        coupon,
        first_delivery: getNextMonday() + " · 9:00 AM",

        drops_total: totalDrops,
        drops_remaining: Math.max(totalDrops - 1, 0),
        next_drop_due: totalDrops > 1 ? nextDropDue(input.cadence) : null,
        // The whole programme is earmarked against budget so the money can't be
        // spent twice, but only the figure above has actually been ordered.
        programme_value_inr: Math.round(perDropTotal * totalDrops),
        ...(perDropNet !== null
          ? { programme_value_after_coupon_inr: Math.round(perDropNet * totalDrops) }
          : {}),
        meals_this_drop: input.servings_per_drop,
        meals_across_programme: totalMeals,
        remaining_drops_note:
          totalDrops > 1
            ? `Drops 2-${totalDrops} are scheduled, not ordered. Each one is re-quoted against the live menu and confirmed with the CSR admin before it runs, so prices and menu changes surface before money moves rather than after.`
            : "Single drop — nothing further scheduled.",
        scheduler_status: "not_yet_running",
        scheduler_note:
          "The recurring runner isn't live in this build, so drops 2+ won't fire on their own yet. Say so if asked — don't imply an automated drop already exists.",

        dietary_notes: input.dietary_notes ?? "none",
        payment_simulated: true,
        payment_note:
          "Menu + cart built against live Swiggy Food MCP — real dishes, real prices, real kitchen. Checkout/payment capture is simulated in this demo build (Food's place_food_order also hard-caps at ₹1000/order in production, well below CSR-scale volumes, so a live rollout would route through Swiggy's enterprise ordering path rather than this single-cart call anyway).",
        source: "real+simulated",
      },
    };
  } catch (err) {
    return callFailed(err);
  }
}

// ─── Food: track_food_order ───────────────────────────────────────────────────
export async function track_food_order(input: {
  program_id: string;
}): Promise<ToolResult> {
  const token = await realMcpToken();
  if (!token) return NOT_CONNECTED;

  // A GreenLedger reference is not a Swiggy order id, and this used to send one
  // straight to Swiggy's tracker. Swiggy has no such order — checkout is
  // simulated, so no order was ever placed — and the empty result read as a
  // transient "no status yet", which the agent then explained away as normal
  // for a delivery slot still days out. It would never have resolved, at any
  // time. Fail honestly instead of producing something that looks like a
  // pending status.
  if (isGreenLedgerReference(input.program_id)) return NO_REAL_ORDER_TO_TRACK;

  try {
    const res = await callSwiggyTool("food", "track_food_order", { orderId: input.program_id }, token);
    return { ok: true, data: { ...(res.data as object), swiggy_order_id: input.program_id, source: "real" } };
  } catch (err) {
    return callFailed(err);
  }
}

// ─── Dineout: search + get_available_slots + book_table ──────────────────────
// Real booking needs a slotId from get_available_slots, which itself needs
// lat/lng (not addressId) per the live schema — so the real branch only
// covers search here; actual slot booking stays unimplemented until this
// tool's schema carries coordinates. See CLAUDE.md pending item 4.
export async function dineout_community_table(input: {
  location: string;
  party_size: number;
  date: string;
  occasion: string;
  dietary?: string;
  latitude?: number;
  longitude?: number;
}): Promise<ToolResult> {
  const token = await realMcpToken();
  if (!token) return NOT_CONNECTED;
  try {
    // search_restaurants_dineout hard-fails with "Location is required"
    // unless given addressId or lat/lng — despite its schema listing only
    // `query` as required. Confirmed live 2026-08-02.
    const locationId = await resolveDineoutLocationId(token, input.location);
    const res = await callSwiggyTool(
      "dineout",
      "search_restaurants_dineout",
      {
        query: input.location,
        entityType: "locality",
        addressId: locationId,
        ...(input.latitude != null && input.longitude != null
          ? { latitude: input.latitude, longitude: input.longitude }
          : {}),
      },
      token
    );
    // This tool returns an empty structuredContent — results live in the
    // prose text only, so parse the `(ID: n)` handles out of it.
    const found = parseDineoutRestaurantText((res.text as string) ?? "");
    if (found.length === 0) {
      return { ok: false, error: `No Dineout venues found near ${input.location}.` };
    }
    return {
      ok: true,
      data: {
        reservations: found.slice(0, 4).map((r) => ({
          restaurant: r.name,
          restaurant_id: r.id,
          rating: r.rating,
          area: r.area,
          // costForTwo isn't in the prose response — left unset, not invented.
          available: true,
        })),
        booked_restaurant: found[0]?.name,
        confirmed_party_size: input.party_size,
        date: input.date,
        occasion: input.occasion,
        note: "Real restaurant search — table booking requires a slot lookup with coordinates, not yet wired up.",
        source: "real",
      },
    };
  } catch (err) {
    return callFailed(err);
  }
}

// ─── Dineout: get_booking_status ──────────────────────────────────────────────
export async function get_dineout_booking_status(input: {
  booking_id: string;
}): Promise<ToolResult> {
  const token = await realMcpToken();
  if (!token) return NOT_CONNECTED;
  try {
    const res = await callSwiggyTool("dineout", "get_booking_status", { orderId: input.booking_id }, token);
    return { ok: true, data: { ...(res.order as object), booking_id: input.booking_id, source: "real" } };
  } catch (err) {
    return callFailed(err);
  }
}

// ─── Our product layer ────────────────────────────────────────────────────────
//
// These take `ctx` as their first argument, not an org id in `input`. The org
// comes from the signed session and is bound in createToolImpls() below, so
// nothing the model emits can select or switch tenants. See lib/server/session.ts.

const NO_ORG: ToolResult = {
  ok: false,
  error:
    "No organization in this session. The user needs to register their organization in the console before any budget or scheduling action can run.",
};

export async function setup_csr_profile(
  ctx: AgentContext | null,
  input: {
    corporate_name: string;
    annual_budget_inr: number;
    fiscal_year_end?: string;
  }
): Promise<ToolResult> {
  await delay(100);
  if (!ctx) return NO_ORG;

  // The admin email is carried over from console registration and is NOT
  // settable from here. It's the identity maker-checker measures the approver
  // against, so letting the agent write it would let a compromised prompt
  // nominate its own counterparty and approve its own spend. If the org was
  // never registered by a human, there is no proposer identity and we refuse
  // rather than invent one.
  const existing = await repo.get(ctx.orgId);
  if (!existing) {
    return {
      ok: false,
      error:
        "This organization hasn't been registered by a human yet. The CSR admin needs to register the organization in the console (name, annual budget, and their email) before a profile can be set up — the admin identity is what approval sign-off is checked against.",
    };
  }

  const profile = await repo.upsert(ctx.orgId, {
    name: input.corporate_name,
    budgetTotalInr: input.annual_budget_inr,
    adminEmail: existing.adminEmail,
    fiscalYearEnd: input.fiscal_year_end,
  });
  return {
    ok: true,
    data: {
      corporate_name: profile.name,
      // Not `budget_total_inr` on purpose — dashboardData.ts detects a full
      // budget snapshot by duck-typing that exact field name off any
      // tool_result, and this response doesn't carry spent/remaining/days,
      // so using the same key would clobber the real one from
      // csr_budget_status with an incomplete object.
      annual_budget_inr: profile.budgetTotalInr,
      fiscal_year_end: profile.fiscalYearEnd,
      message: `CSR profile set up for ${profile.name} — ₹${profile.budgetTotalInr.toLocaleString("en-IN")} annual budget.`,
    },
  };
}

/** Read-only. Deliberately has no verify capability — see lib/server/ngoStore.ts. */
export async function list_donees(ctx: AgentContext | null): Promise<ToolResult> {
  await delay(80);
  if (!ctx) return NO_ORG;
  const all = await ngos.list(ctx.orgId);
  return {
    ok: true,
    data: {
      donees: all.map((n) => ({
        name: n.name,
        verified: n.verified,
        reg_80g: n.reg80g ?? null,
        has_on_site_kitchen: n.hasOnSiteKitchen ?? null,
        address: n.address ?? null,
      })),
      note:
        all.length === 0
          ? "No donees registered. A human must register and verify a donee in the console before spend can be committed to them."
          : "Use the `name` exactly as shown when scheduling — donee matching is exact, and spend to an unverified donee is refused by policy.",
    },
  };
}

export async function csr_budget_status(ctx: AgentContext | null): Promise<ToolResult> {
  await delay(100);
  if (!ctx) return NO_ORG;
  const profile = await repo.get(ctx.orgId);
  if (!profile) {
    return {
      ok: false,
      error: "No CSR profile set up yet — call setup_csr_profile first with the corporate's name and annual budget.",
    };
  }
  const budget_total = profile.budgetTotalInr;
  // Spend comes from the LEDGER, which is the only source of truth for it.
  //
  // This used to read a counter that only schedule_program incremented, while
  // the policy engine measured its ceilings against the ledger. So a Food or
  // Instamart programme could commit lakhs — recorded on the ledger, counted by
  // policy — and this tool would still report ₹0 spent and flag "underspend
  // risk". The agent then tells a CSR head they have their whole budget left.
  // Two sources of truth for money is one too many.
  const budget_spent = await ledger.totalCommittedInr(ctx.orgId);
  const budget_remaining = budget_total - budget_spent;
  const utilization_pct = Math.round((budget_spent / budget_total) * 100);
  const today = new Date();
  const yearEnd = new Date(today.getFullYear(), 2, 31); // March 31
  if (yearEnd < today) yearEnd.setFullYear(yearEnd.getFullYear() + 1);
  const days_to_year_end = Math.ceil((yearEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const daily_pace_needed = days_to_year_end > 0 ? Math.round(budget_remaining / days_to_year_end) : budget_remaining;
  return {
    ok: true,
    data: {
      corporate_name: profile.name,
      budget_total_inr: budget_total,
      budget_spent_inr: budget_spent,
      budget_remaining_inr: budget_remaining,
      utilization_pct,
      days_to_year_end,
      daily_pace_needed_inr: daily_pace_needed,
      alert: utilization_pct < 60 && days_to_year_end < 120
        ? `⚠️ Only ${utilization_pct}% utilized with ${days_to_year_end} days left. Need to deploy ₹${daily_pace_needed.toLocaleString("en-IN")}/day to hit target.`
        : null,
    },
  };
}

export async function schedule_program(
  ctx: AgentContext | null,
  input: {
    program_name: string;
    ngo_name: string;
    total_budget_inr: number;
    cadence: "weekly" | "biweekly" | "monthly";
    components: { type: string; budget_inr: number; description: string }[];
  }
): Promise<ToolResult> {
  await delay(200);
  if (!ctx) return NO_ORG;
  const profile = await repo.get(ctx.orgId);
  if (!profile) {
    return {
      ok: false,
      error: "No CSR profile set up yet — call setup_csr_profile first.",
    };
  }
  // No recordSpend here. withPolicy writes the commitment to the ledger, and
  // the ledger is what every spend figure is derived from — incrementing a
  // second counter here would double-count against itself.
  const program_id = `PROG-${Date.now()}`;
  return {
    ok: true,
    data: {
      program_id,
      program_name: input.program_name,
      ngo: input.ngo_name,
      cadence: input.cadence,
      total_budget_inr: input.total_budget_inr,
      components: input.components,
      next_run: getNextSaturday() + " · 10:00 AM",
      status: "active",
      // No "proceeds automatically if no response within 24h". That promised
      // unattended spend on a silence, which is the opposite of every control
      // in this product — a drop that nobody confirmed is exactly what the
      // approval gate exists to prevent. Silence is not consent.
      confirmation_message: `📋 *${input.program_name}* scheduled.\n` +
        `• NGO: ${input.ngo_name}  •  Earmarked: ₹${input.total_budget_inr.toLocaleString("en-IN")}  •  Cadence: ${input.cadence}\n` +
        `• Next run: ${getNextSaturday()}\n\n` +
        `Each run is confirmed with the CSR admin before it executes. Nothing goes out on a silence.`,
    },
  };
}

export async function generate_80g_receipt(
  ctx: AgentContext | null,
  input: {
    corporate_name: string;
    pan: string;
    amount_inr: number;
    beneficiary_ngo: string;
    ngo_80g_reg: string;
  }
): Promise<ToolResult> {
  await delay();
  if (!ctx) return NO_ORG;

  const receipt_id = `80G-${Date.now()}`;
  const issuedAt = new Date();
  const donee = await ngos.get(ctx.orgId, input.beneficiary_ngo);

  const pdf = renderDocument({
    eyebrow: "Issued via GreenLedger",
    title: "Donation Receipt",
    subtitle: `Section 80G | Receipt ${receipt_id}`,
    sections: [
      {
        heading: "Donee",
        rows: [
          { label: "Organisation", value: input.beneficiary_ngo },
          { label: "80G registration (as provided)", value: input.ngo_80g_reg },
          {
            label: "Registration verified",
            value: donee?.verified ? `Yes - ${new Date(donee.verifiedAt ?? 0).toLocaleDateString("en-IN")}` : "No",
          },
        ],
      },
      {
        heading: "Donor",
        rows: [
          { label: "Name", value: input.corporate_name },
          { label: "PAN", value: input.pan },
        ],
      },
      {
        heading: "Contribution",
        rows: [
          { label: "Amount", value: formatInr(input.amount_inr) },
          { label: "Date of issue", value: issuedAt.toLocaleDateString("en-IN") },
        ],
      },
    ],
    footnotes: [
      "This document records a contribution received by the donee named above. It does not determine the donor's tax treatment.",
      "Deductibility of CSR contributions is unsettled: Explanation 2 to Section 37(1) disallows CSR spend as a business deduction, and Explanation 2 to Section 80G(2) carves out CSR contributions to Swachh Bharat Kosh and Clean Ganga Fund. Appellate tribunals have allowed Section 80G relief for other registered donees. The position is donee-specific and should be assessed by the donor's tax advisers.",
      "GreenLedger makes no representation that any amount shown here is deductible.",
    ],
  });

  const artifact = await artifacts.put({
    orgId: ctx.orgId,
    kind: "80g_receipt",
    filename: `80g-receipt-${receipt_id}.pdf`,
    bytes: pdf,
  });

  return {
    ok: true,
    data: {
      receipt_id,
      pdf_url: `/api/documents/${artifact.id}`,
      amount_inr: input.amount_inr,
      donee_80g_reg_as_stated: input.ngo_80g_reg,
      donee_registration_verified: donee?.verified ?? false,
      // Deliberately NOT asserting deductibility. Explanation 2 to Sec 37(1)
      // disallows CSR as a business deduction, and Explanation 2 to Sec 80G(2)
      // carves out CSR contributions for Swachh Bharat / Clean Ganga; ITAT has
      // gone the other way for registered donees (Goldman Sachs Services,
      // Allegis), so it is arguable but unsettled and donee-dependent. Until
      // counsel rules, this is a document from the donee, not a deduction we
      // are promising. Do not add a `tax_deductible_inr` field back.
      tax_treatment_note:
        "This is an 80G receipt issued by the donee. Deductibility of CSR contributions is unsettled and donee-dependent — route this to your tax team to assess. GreenLedger makes no deduction claim.",
      issued_at: new Date().toISOString(),
    },
  };
}

export async function impact_dashboard_update(input: {
  program_id: string;
  meals_served: number;
  beneficiary_ngo: string;
  amount_spent_inr: number;
  coupon_savings_inr?: number;
}): Promise<ToolResult> {
  await delay();
  const cost_per_meal = input.amount_spent_inr / input.meals_served;
  const savings = input.coupon_savings_inr ?? 0;
  return {
    ok: true,
    data: {
      updated: true,
      meals_served: input.meals_served,
      cost_per_meal_inr: Math.round(cost_per_meal * 100) / 100,
      effective_cost_per_meal_inr: Math.round(((input.amount_spent_inr - savings) / input.meals_served) * 100) / 100,
      coupon_savings_inr: savings,
      // No CO2 or ESG-score figure is returned. Both were previously fabricated
      // constants (meals * 0.4 kg, "+0.8"). ESG disclosures are BRSR-audited —
      // an invented number in front of a sustainability head is worse than no
      // number. Re-add only with a cited, defensible methodology attached.
      photo_proof_pending_ngo_upload: true,
    },
  };
}

export async function generate_gst_invoice(
  ctx: AgentContext | null,
  input: GstInvoiceInput
): Promise<ToolResult> {
  await delay(150);
  if (!ctx) return NO_ORG;
  return { ok: true, data: await buildGstInvoice(ctx, input) };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getNextSaturday(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

/** When the next drop in a recurring programme would fall due. */
function nextDropDue(cadence: "daily" | "weekly" | "biweekly" | "monthly"): string {
  const d = new Date();
  const days = cadence === "daily" ? 1 : cadence === "weekly" ? 7 : cadence === "biweekly" ? 14 : 30;
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function getNextMonday(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((1 - d.getDay() + 7) % 7 || 7));
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * Build the tool implementations for one request, with the organization bound
 * from the session.
 *
 * The org-scoped tools are wrapped so `ctx` is closed over rather than read out
 * of the model's tool input. This is the enforcement point for tenant
 * isolation: a `corporate_id` in the model's arguments has nowhere to land.
 * Pass `null` for an unauthenticated request — org-scoped tools then refuse,
 * and the Swiggy/product tools that don't touch org state still work.
 */
export function createToolImpls(ctx: AgentContext | null) {
  const impls = {
    instamart_search_bulk,
    instamart_schedule_recurring,
    track_instamart_order,
    food_partner_kitchens,
    food_menu_quote,
    food_schedule_meal_program,
    track_food_order,
    dineout_community_table,
    get_dineout_booking_status,

    // Org-scoped — ctx bound here, never taken from tool input.
    setup_csr_profile: (input: Parameters<typeof setup_csr_profile>[1]) =>
      setup_csr_profile(ctx, input),
    csr_budget_status: () => csr_budget_status(ctx),
    list_donees: () => list_donees(ctx),
    schedule_program: (input: Parameters<typeof schedule_program>[1]) =>
      schedule_program(ctx, input),

    generate_80g_receipt: (input: Parameters<typeof generate_80g_receipt>[1]) =>
      generate_80g_receipt(ctx, input),
    generate_gst_invoice: (input: GstInvoiceInput) => generate_gst_invoice(ctx, input),
    impact_dashboard_update,
  };

  // Every tool goes through the policy gate — the whole map, not a hand-picked
  // list. A new money-spending tool added above is gated by default; the worst
  // case is that the policy engine doesn't yet know it commits money (declare
  // it in COMMITTING_TOOLS), not that it silently bypasses the gate entirely.
  return withPolicy(ctx, impls);
}

export type ToolName = keyof ReturnType<typeof createToolImpls>;
