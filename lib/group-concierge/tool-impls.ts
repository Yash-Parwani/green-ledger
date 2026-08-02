// Dineout/Food/Instamart search and booking tools call the real Swiggy MCP
// servers only — no fabricated fallback data. If SWIGGY_MCP_ENABLED is off,
// no admin is connected, or the real call fails, these return an honest
// `ok:false` error instead of inventing restaurant/vendor names. Connect via
// the "Connect Swiggy account" control in the console header.
// `food_create_group_order` stays simulated: real order placement needs a
// menu-aware cart built from search_menu/get_restaurant_menu item IDs this
// single-shot function doesn't have — same constraint noted in
// lib/second-helping/tool-impls.ts.

import { isSwiggyMcpEnabled, getValidSwiggyToken } from "@/lib/shared/swiggy-auth";
import {
  callSwiggyTool,
  resolveFoodOrInstamartAddressId,
  resolveDineoutLocationId,
  parseDineoutRestaurantText,
} from "@/lib/shared/swiggy-mcp-client";
import { applyBestCouponAtCheckout } from "@/lib/shared/food-coupons";
import { withPolicy } from "@/lib/server/withPolicy";
import { buildGstInvoice, type GstInvoiceInput } from "@/lib/server/gstInvoice";
import type { AgentContext } from "@/lib/server/session";

type ToolResult = { ok: true; data: unknown } | { ok: false; error: string };

const delay = (ms = 180) => new Promise((r) => setTimeout(r, ms));

const NOT_CONNECTED: ToolResult = {
  ok: false,
  error: "Swiggy isn't connected — connect your Swiggy account (console header) to search real results.",
};

async function realMcpToken(): Promise<string | null> {
  if (!isSwiggyMcpEnabled()) return null;
  return getValidSwiggyToken();
}

function callFailed(err: unknown): ToolResult {
  return { ok: false, error: `Couldn't reach Swiggy just now: ${(err as Error).message}` };
}

// ---------- Dineout ----------
// Real search doesn't return venue capacity or slot lists (those need a
// per-restaurant get_available_slots call) — capacity falls back to the
// requested party size and available_slots stays empty; extractPlanCards
// (lib/group-concierge/extractPlans.ts) tolerates both being absent.
export async function dineout_search_restaurants(input: {
  location: string;
  cuisine?: string;
  party_size: number;
  date: string;
}): Promise<ToolResult> {
  const token = await realMcpToken();
  if (!token) return NOT_CONNECTED;
  try {
    const query = input.cuisine ? `${input.cuisine} ${input.location}` : input.location;
    // Requires addressId or lat/lng or it hard-fails "Location is required",
    // despite the schema listing only `query` as required (live 2026-08-02).
    const locationId = await resolveDineoutLocationId(token, input.location);
    const res = await callSwiggyTool(
      "dineout",
      "search_restaurants_dineout",
      { query, entityType: input.cuisine ? "CUISINE" : "locality", addressId: locationId },
      token
    );
    // Empty structuredContent on this tool — parse the prose text instead.
    const found = parseDineoutRestaurantText((res.text as string) ?? "");
    if (found.length === 0) {
      return { ok: false, error: `No Dineout venues found near ${input.location}.` };
    }
    return {
      ok: true,
      data: {
        results: found.slice(0, 5).map((r) => ({
          id: r.id,
          name: r.name,
          rating: r.rating,
          area: r.area,
          cuisine: input.cuisine ?? "",
          capacity: input.party_size,
          // price_per_head isn't in the prose response — unset, not invented.
          available_slots: [] as string[],
        })),
        query: input,
        source: "real",
      },
    };
  } catch (err) {
    return callFailed(err);
  }
}

// Real booking is a two-call flow: get_available_slots (needs lat/lng) to
// find the slotId matching the requested time, then book_table with that
// slot. latitude/longitude are optional extras on this tool's schema — the
// LLM only has them if a prior step surfaced coordinates.
export async function dineout_reserve(input: {
  restaurant_id: string;
  party_size: number;
  date: string;
  time: string;
  host_name: string;
  latitude?: number;
  longitude?: number;
}): Promise<ToolResult> {
  const token = await realMcpToken();
  if (!token) return NOT_CONNECTED;
  if (input.latitude == null || input.longitude == null) {
    return {
      ok: false,
      error: "Booking needs the venue's coordinates, which aren't available in this flow yet — search again with a location that resolves to a saved address.",
    };
  }
  try {
    const slotsRes = await callSwiggyTool(
      "dineout",
      "get_available_slots",
      { restaurantId: input.restaurant_id, date: input.date, latitude: input.latitude, longitude: input.longitude },
      token
    );
    const slots = (slotsRes.slots ?? []) as {
      slotId?: number;
      itemId?: string;
      reservationTime?: number;
      displayTime?: string;
      deals?: { isFree?: boolean; bookingPrice?: number }[];
    }[];
    const match = slots.find((s) => s.displayTime === input.time) ?? slots[0];
    if (!match?.slotId || !match.itemId || match.reservationTime == null) {
      return { ok: false, error: "No matching table slot found for that time." };
    }
    const bookRes = await callSwiggyTool(
      "dineout",
      "book_table",
      {
        restaurantId: input.restaurant_id,
        slotId: match.slotId,
        itemId: match.itemId,
        reservationTime: match.reservationTime,
        guestCount: input.party_size,
        latitude: input.latitude,
        longitude: input.longitude,
        paymentMethod: "Cash",
      },
      token
    );
    return {
      ok: true,
      data: { ...(bookRes.data as object), reservation_id: (bookRes.data as { orderId?: string })?.orderId, source: "real" },
    };
  } catch (err) {
    return callFailed(err);
  }
}

// ---------- Food ----------
// search_restaurants' confirmed fields are availabilityStatus/distanceKm/
// nextOffset — rating/eta/price-per-plate aren't documented, so those stay
// 0 rather than a fabricated plausible-looking number; extractPlanCards
// still renders correctly with 0s.
export async function food_search_restaurants(input: {
  location: string;
  cuisine?: string;
  dietary?: string[];
}): Promise<ToolResult> {
  const token = await realMcpToken();
  if (!token) return NOT_CONNECTED;
  try {
    const addressId = await resolveFoodOrInstamartAddressId("food", token, input.location);
    const res = await callSwiggyTool(
      "food",
      "search_restaurants",
      { addressId, query: input.cuisine ?? input.location },
      token
    );
    const data = res.data as { restaurants?: unknown[]; results?: unknown[] } | undefined;
    const found = (data?.restaurants ?? data?.results ?? []) as {
      restaurantId?: string;
      id?: string;
      name?: string;
      availabilityStatus?: string;
    }[];
    const open = found.filter((r) => r.availabilityStatus !== "CLOSED");
    return {
      ok: true,
      data: {
        results: open.slice(0, 5).map((r) => ({
          id: r.restaurantId ?? r.id,
          name: r.name,
          cuisine: input.cuisine ?? "",
          rating: 0,
          eta_min: 0,
          avg_per_plate: 0,
        })),
        source: "real",
      },
    };
  } catch (err) {
    return callFailed(err);
  }
}

// Builds a REAL cart against live Swiggy Food MCP — real dishes, real prices,
// a real update_food_cart call — and stops before checkout.
//
// This previously invented the total as `quantity * 450` per item and returned
// it as if it were a real order. A per-head split derived from a made-up price
// is worse than no number: it's the figure a committee actually collects money
// against. If we can't cost a line from the live menu, we don't ship a line.
export async function food_create_group_order(input: {
  restaurant_id: string;
  items: { name: string; quantity: number; notes?: string }[];
  delivery_address: string;
  delivery_time: string;
  split_payment_among: number;
  dietary_notes?: string;
}): Promise<ToolResult> {
  const token = await realMcpToken();
  if (!token) return NOT_CONNECTED;
  if (input.split_payment_among < 1) {
    return { ok: false, error: "split_payment_among must be at least 1." };
  }
  try {
    const addressId = await resolveFoodOrInstamartAddressId("food", token, input.delivery_address);

    const cartItems: Record<string, unknown>[] = [];
    const menuSummary: { name: string; quantity: number; price_inr: number }[] = [];
    const unmatched: string[] = [];
    let total = 0;
    let restaurantName: string | undefined;

    // A neutral query on live search_menu returns non-veg (a "rice" search came
    // back with chicken biryani), so a veg event must pass vegFilter — see the
    // same guard in lib/second-helping/tool-impls.ts.
    const vegOnly = /\bveg\b|vegetarian|jain|no.?onion|satvik/i.test(input.dietary_notes ?? "");

    for (const pick of input.items) {
      const res = await callSwiggyTool(
        "food",
        "search_menu",
        {
          addressId,
          query: pick.name,
          restaurantIdOfAddedItem: input.restaurant_id,
          ...(vegOnly ? { vegFilter: 1 } : {}),
        },
        token
      );
      const found = ((res.data as { items?: Record<string, unknown>[] } | undefined)?.items ??
        []) as Record<string, unknown>[];
      // A cart may only contain items from one restaurant, and search can
      // return items from others even when scoped.
      const match = found.find(
        (i) => i.inStock !== 0 && String(i.restaurant_id ?? input.restaurant_id) === String(input.restaurant_id)
      );
      const price = typeof match?.price === "number" ? (match.price as number) : 0;
      if (!match || !price) {
        unmatched.push(pick.name);
        continue;
      }
      restaurantName ??= match.restaurant_name as string | undefined;
      total += price * pick.quantity;
      cartItems.push({
        menu_item_id: match.menu_item_id,
        quantity: pick.quantity,
        ...(match.hasVariants ? { variations: match.variations, variantsV2: match.variantsV2 } : {}),
      });
      menuSummary.push({ name: (match.name as string) ?? pick.name, quantity: pick.quantity, price_inr: price });
    }

    if (cartItems.length === 0) {
      return {
        ok: false,
        error: `None of the requested dishes matched this restaurant's live menu (${input.items
          .map((i) => i.name)
          .join(", ")}). Try different dish names, or search the menu first.`,
      };
    }

    await callSwiggyTool(
      "food",
      "update_food_cart",
      { restaurantId: input.restaurant_id, cartItems, addressId, restaurantName },
      token
    );

    // Cart assembled, about to (simulate) paying — the only point where a
    // coupon lookup is valid, and the point an organizer would expect it.
    const coupon = await applyBestCouponAtCheckout({
      token,
      restaurantId: input.restaurant_id,
      addressId,
    });
    const netTotal = coupon.savings_inr !== null ? Math.max(total - coupon.savings_inr, 0) : null;

    return {
      ok: true,
      data: {
        cart_id: `FD-GRP-${Date.now()}`,
        restaurant: restaurantName ?? input.restaurant_id,
        menu: menuSummary,
        coupon,
        ...(netTotal !== null
          ? {
              total_after_coupon_inr: Math.round(netTotal),
              per_person_after_coupon_inr: Math.round(netTotal / input.split_payment_among),
            }
          : {}),
        // Surfaced, not swallowed: a silently shorter order is how a group
        // event ends up under-catered.
        unmatched_items: unmatched,
        total_inr: Math.round(total),
        per_person_inr: Math.round(total / input.split_payment_among),
        splitting_among: input.split_payment_among,
        requested_delivery: input.delivery_time,
        payment_simulated: true,
        payment_note:
          "Menu and cart built against live Swiggy Food MCP — real dishes, real prices, real restaurant. Checkout and payment capture are simulated in this build; no money moves and no UPI collect requests are sent. Swiggy's place_food_order has no dry-run mode and hard-caps at ₹1000/order in production.",
        source: "real+simulated",
      },
    };
  } catch (err) {
    return callFailed(err);
  }
}

// ---------- Instamart ----------
// spin_id/sku_id are the real variation identifiers, so a later
// instamart_add_to_cart call can round-trip them straight back into
// update_cart. Live shape (confirmed 2026-08-02): the display field is
// `displayName` (not `name`), and `price` is an OBJECT
// {mrp, offerPrice, unitLevelPrice} — not a number.
export async function instamart_search(input: { query: string; location: string }): Promise<ToolResult> {
  const token = await realMcpToken();
  if (!token) return NOT_CONNECTED;
  try {
    const addressId = await resolveFoodOrInstamartAddressId("instamart", token, input.location);
    const res = await callSwiggyTool("instamart", "search_products", { addressId, query: input.query }, token);
    const products = ((res.data as { products?: unknown[] } | undefined)?.products ?? []) as {
      displayName?: string;
      brand?: string;
      inStock?: boolean;
      isAvail?: boolean;
      variations?: {
        spinId?: string;
        skuId?: string;
        quantityDescription?: string;
        price?: { mrp?: number; offerPrice?: number; unitLevelPrice?: string };
      }[];
    }[];
    return {
      ok: true,
      data: {
        results: products
          .filter((p) => p.inStock !== false && p.isAvail !== false)
          .slice(0, 6)
          .map((p) => {
            const v = p.variations?.[0];
            return {
              spin_id: v?.spinId ?? "",
              sku_id: v?.skuId ?? "",
              name: p.displayName ?? "",
              brand: p.brand ?? "",
              price: v?.price?.offerPrice ?? v?.price?.mrp ?? 0,
              unit: v?.quantityDescription ?? "",
              unit_price: v?.price?.unitLevelPrice ?? "",
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

// Builds a REAL Instamart cart, then STOPS. It must never call `checkout`.
//
// This previously called instamart `checkout` with paymentMethod:"Cash",
// which places a real order and captures real money. It went unnoticed
// because every Instamart call was 404ing on a wrong mount path
// (`/instamart` instead of `/im`) — fixing the path would have armed it.
// Group Concierge spends pooled/organizational money; nothing here places an
// order until there's an approval gate and real payment credentials.
export async function instamart_add_to_cart(input: {
  items: { spin_id: string; sku_id?: string; quantity: number }[];
  delivery_address: string;
  delivery_time: string;
}): Promise<ToolResult> {
  const token = await realMcpToken();
  if (!token) return NOT_CONNECTED;
  try {
    const addressId = await resolveFoodOrInstamartAddressId("instamart", token, input.delivery_address);
    const cartRes = await callSwiggyTool(
      "instamart",
      "update_cart",
      {
        selectedAddressId: addressId,
        // spinId and skuId are DISTINCT identifiers on a variation
        // (e.g. spinId "Y1M870H78G" / skuId "FBU5X8FDGG") — this used to
        // send the same value for both.
        items: input.items.map((i) => ({
          spinId: i.spin_id,
          ...(i.sku_id ? { skuId: i.sku_id } : {}),
          quantity: i.quantity,
        })),
      },
      token
    );
    return {
      ok: true,
      data: {
        cart: cartRes.data,
        delivery_time: input.delivery_time,
        payment_simulated: true,
        payment_note:
          "Cart built against live Swiggy Instamart MCP — real products, real prices. Checkout/payment capture is NOT performed in this build; no money has moved and no order was placed.",
        source: "real+simulated",
      },
    };
  } catch (err) {
    return callFailed(err);
  }
}

// ---------- Our product layer ----------
// Invoice arithmetic and rendering are shared with Second Helping — see
// lib/server/gstInvoice.ts. Both products issue the same document for the same
// reason, so there is one implementation rather than two that drift.
export async function generate_gst_invoice(
  ctx: AgentContext | null,
  input: GstInvoiceInput
): Promise<ToolResult> {
  await delay(150);
  if (!ctx) {
    return {
      ok: false,
      error:
        "No organization in this session. The organizer needs to register their organization in the console before tax invoices can be issued.",
    };
  }
  return { ok: true, data: await buildGstInvoice(ctx, input) };
}

/**
 * Build this request's tool implementations, gated by the same policy engine
 * the CSR console uses. Group Concierge spend is organizational/pooled — an
 * RWA, a company, an NGO programme — so it belongs under the same approval,
 * role and audit controls. Flipping the console's mode switch must not step
 * around a control.
 */
export function createToolImpls(ctx: AgentContext | null) {
  return withPolicy(ctx, {
    dineout_search_restaurants,
    dineout_reserve,
    food_search_restaurants,
    food_create_group_order,
    instamart_search,
    instamart_add_to_cart,
    generate_gst_invoice: (input: GstInvoiceInput) => generate_gst_invoice(ctx, input),
  });
}

export type ToolName = keyof ReturnType<typeof createToolImpls>;
