// Coupon check at checkout, shared by both products.
//
// Swiggy documents fetch_food_coupons and apply_food_coupon at the CART stage,
// and calling them before a cart exists returns HTTP 400. Exposing them as
// standalone tools meant the agent reached for them while it was still
// quoting — the one moment they cannot work — and then retried, producing two
// identical 400s in a row.
//
// So they aren't agent-facing any more. This runs inside the cart builders,
// immediately after update_food_cart and immediately before the (simulated)
// checkout, which is both the only valid moment and the moment a human would
// expect it: cart assembled, about to pay, check for a discount.
//
// The response shape is NOT documented — the reference describes "best coupons,
// more offers, and payment offers with applicability status and discount
// amounts" but gives no field names or example payload (verified 2026-08-02).
// So parsing here is deliberately lenient and never invents a figure: if we
// can't read a saving we say so and hand back the raw payload rather than
// reporting zero. Unknown and zero are different numbers, and only one of them
// is honest.

import { callSwiggyTool } from "@/lib/shared/swiggy-mcp-client";

export type CouponOutcome = {
  checked: boolean;
  coupon_code: string | null;
  savings_inr: number | null;
  /** Present when the lookup or apply failed — savings are unknown, not zero. */
  error?: string;
  note: string;
  /** Undocumented shape, passed through so the agent can read what we couldn't. */
  raw?: unknown;
};

/** Pull plausible coupon codes out of an undocumented payload. */
function findCouponCodes(payload: unknown, depth = 0): string[] {
  if (!payload || typeof payload !== "object" || depth > 4) return [];
  const out: string[] = [];
  const visit = (node: unknown, d: number) => {
    if (!node || typeof node !== "object" || d > 4) return;
    if (Array.isArray(node)) {
      for (const n of node) visit(n, d + 1);
      return;
    }
    const obj = node as Record<string, unknown>;
    for (const key of ["couponCode", "coupon_code", "code"]) {
      const v = obj[key];
      // Swiggy coupon codes are short uppercase-ish tokens; a long string here
      // is almost certainly a description, not a code.
      if (typeof v === "string" && v.trim() && v.length <= 32) out.push(v.trim());
    }
    for (const v of Object.values(obj)) visit(v, d + 1);
  };
  visit(payload, depth);
  return [...new Set(out)];
}

/** Pull a discount figure out of an undocumented payload. */
function findSavings(payload: unknown): number | null {
  let best: number | null = null;
  const visit = (node: unknown, d: number) => {
    if (!node || typeof node !== "object" || d > 5) return;
    if (Array.isArray(node)) {
      for (const n of node) visit(n, d + 1);
      return;
    }
    const obj = node as Record<string, unknown>;
    for (const key of [
      "totalDiscount",
      "discountAmount",
      "couponDiscount",
      "savings",
      "totalSavings",
    ]) {
      const v = obj[key];
      if (typeof v === "number" && Number.isFinite(v) && v > 0) {
        best = best === null ? v : Math.max(best, v);
      }
    }
    for (const v of Object.values(obj)) visit(v, d + 1);
  };
  visit(payload, 0);
  return best;
}

/**
 * Check for a coupon on an already-built cart and apply the best one.
 * Never throws: a coupon is an optimisation, and failing to find one must not
 * take down a programme that is otherwise ready.
 */
export async function applyBestCouponAtCheckout(opts: {
  token: string;
  restaurantId: string;
  addressId: string;
}): Promise<CouponOutcome> {
  const { token, restaurantId, addressId } = opts;

  let offers: unknown;
  try {
    const res = await callSwiggyTool("food", "fetch_food_coupons", { restaurantId, addressId }, token);
    offers = res.data ?? res;
  } catch (err) {
    return {
      checked: false,
      coupon_code: null,
      savings_inr: null,
      error: (err as Error).message,
      note: "Coupon lookup failed, so any saving is UNKNOWN — not zero. The programme total below is the undiscounted figure.",
    };
  }

  const codes = findCouponCodes(offers);
  if (codes.length === 0) {
    return {
      checked: true,
      coupon_code: null,
      savings_inr: null,
      note: "Checked for coupons at checkout; none applicable to this cart.",
      raw: offers,
    };
  }

  try {
    const applied = await callSwiggyTool(
      "food",
      "apply_food_coupon",
      { couponCode: codes[0], addressId },
      token
    );
    const savings = findSavings(applied.data ?? applied);
    return {
      checked: true,
      coupon_code: codes[0],
      savings_inr: savings,
      note:
        savings !== null
          ? `Coupon ${codes[0]} applied at checkout.`
          : `Coupon ${codes[0]} applied, but the saving couldn't be read from Swiggy's response — treat it as UNKNOWN, not zero, and check the cart.`,
      raw: applied.data ?? applied,
    };
  } catch (err) {
    return {
      checked: true,
      coupon_code: codes[0],
      savings_inr: null,
      error: (err as Error).message,
      note: `Found coupon ${codes[0]} but couldn't apply it. Saving is UNKNOWN — not zero.`,
      raw: offers,
    };
  }
}
