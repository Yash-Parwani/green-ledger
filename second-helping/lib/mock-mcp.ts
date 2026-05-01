// Mock Swiggy MCP clients for the CSR procurement use case.
// Pattern: replace each function body with a real Swiggy MCP client call
// once Swiggy Builders Club grants access. The tool contracts stay identical.
//
// Real MCP endpoints:
//   Food:      POST mcp.swiggy.com/food
//   Instamart: POST mcp.swiggy.com/im
//   Dineout:   POST mcp.swiggy.com/dineout

type ToolResult = { ok: true; data: unknown } | { ok: false; error: string };
const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));

// Realistic per-category prices (₹/kg) used consistently across tools
const CATEGORY_PRICES: Record<string, number> = {
  rice: 62, dal: 110, oil: 145, wheat: 38, salt: 22, spices: 280,
};

// ─── Instamart: search_products ──────────────────────────────────────────────
export async function instamart_search_bulk(input: {
  category: "rice" | "dal" | "oil" | "wheat" | "salt" | "spices";
  quantity_kg: number;
  location: string;
}): Promise<ToolResult> {
  await delay();
  const unit = CATEGORY_PRICES[input.category] ?? 80;
  return {
    ok: true,
    data: {
      best_offers: [
        { vendor: "Daawat (via Instamart)", price_per_kg_inr: unit, bulk_discount_pct: 12, eta_hr: 6 },
        { vendor: "Fortune (via Instamart)", price_per_kg_inr: Math.round(unit * 1.05), bulk_discount_pct: 8, eta_hr: 4 },
      ],
      query: input,
    },
  };
}

// ─── Instamart: update_cart + checkout (our recurring cron layer) ─────────────
export async function instamart_schedule_recurring(input: {
  items: { category: string; quantity_kg: number; vendor: string; price_per_kg_inr: number }[];
  delivery_address: string;
  cadence: "weekly" | "biweekly" | "monthly";
  weeks: number;
  ngo_name: string;
}): Promise<ToolResult> {
  await delay();
  // FIX: use the actual price_per_kg_inr from each item (not a flat ₹80)
  const total = input.items.reduce((s, i) => s + i.quantity_kg * i.price_per_kg_inr, 0);
  const cadenceMultiplier = { weekly: 1, biweekly: 0.5, monthly: 0.25 }[input.cadence] ?? 1;
  const totalDrops = Math.ceil(input.weeks * cadenceMultiplier);
  return {
    ok: true,
    data: {
      schedule_id: `IM-RC-${Date.now()}`,
      ngo: input.ngo_name,
      total_per_drop_inr: Math.round(total),
      total_program_inr: Math.round(total * totalDrops),
      drops_scheduled: totalDrops,
      next_delivery: getNextSaturday(),
      cadence: input.cadence,
    },
  };
}

// ─── Instamart: track_order ──────────────────────────────────────────────────
export async function track_instamart_order(input: {
  schedule_id: string;
}): Promise<ToolResult> {
  await delay(300);
  return {
    ok: true,
    data: {
      schedule_id: input.schedule_id,
      first_drop_status: "confirmed",
      rider_name: "Ravi Kumar",
      rider_contact: "+91-9845XXXXXX",
      eta: getNextSaturday() + " · 11:15 AM",
      live_tracking_url: `https://swiggy.com/track/${input.schedule_id}`,
    },
  };
}

// ─── Food: search_restaurants ────────────────────────────────────────────────
export async function food_partner_kitchens(input: {
  location: string;
  meal_type: "north_indian" | "south_indian" | "khichdi" | "biryani";
  servings: number;
  dietary?: string[];
}): Promise<ToolResult> {
  await delay();
  const dietaryTag = input.dietary?.includes("veg") ? " (Veg certified)" : "";
  return {
    ok: true,
    data: {
      kitchens: [
        { id: "pk_1", name: `Annapurna Community Kitchen${dietaryTag}`, per_meal_inr: 65, capacity_per_day: 800, certified_fssai: true, dietary_compliance: input.dietary ?? [] },
        { id: "pk_2", name: `Akshaya Kitchen Co.${dietaryTag}`, per_meal_inr: 78, capacity_per_day: 1500, certified_fssai: true, dietary_compliance: input.dietary ?? [] },
      ],
      query: input,
    },
  };
}

// ─── Food: fetch_food_coupons ─────────────────────────────────────────────────
export async function fetch_food_coupons(input: {
  kitchen_id: string;
  order_value_inr: number;
}): Promise<ToolResult> {
  await delay(150);
  const coupons = input.order_value_inr >= 5000
    ? [
        { code: "BULK15", description: "15% off bulk CSR orders above ₹5,000", discount_pct: 15, max_discount_inr: 3000, applicable: true },
        { code: "CSRFIRST", description: "₹500 flat off first CSR program", discount_inr: 500, applicable: true },
      ]
    : [
        { code: "SWIGGY10", description: "10% off orders above ₹1,000", discount_pct: 10, max_discount_inr: 500, applicable: true },
      ];
  return { ok: true, data: { coupons, order_value_inr: input.order_value_inr } };
}

// ─── Food: apply_food_coupon ──────────────────────────────────────────────────
export async function apply_food_coupon(input: {
  kitchen_id: string;
  coupon_code: string;
  order_value_inr: number;
}): Promise<ToolResult> {
  await delay(150);
  const discountMap: Record<string, number> = { BULK15: 0.15, SWIGGY10: 0.10 };
  const flatMap: Record<string, number> = { CSRFIRST: 500 };
  let savings = 0;
  if (discountMap[input.coupon_code]) {
    savings = Math.min(Math.round(input.order_value_inr * discountMap[input.coupon_code]), input.coupon_code === "BULK15" ? 3000 : 500);
  } else if (flatMap[input.coupon_code]) {
    savings = flatMap[input.coupon_code];
  }
  if (savings === 0) return { ok: false, error: `Coupon ${input.coupon_code} is not applicable to this order.` };
  return {
    ok: true,
    data: {
      coupon_applied: input.coupon_code,
      savings_inr: savings,
      final_order_value_inr: input.order_value_inr - savings,
      message: `Applied ${input.coupon_code} — saved ₹${savings.toLocaleString("en-IN")}`,
    },
  };
}

// ─── Food: place_food_order (our recurring cron layer) ───────────────────────
export async function food_schedule_meal_program(input: {
  kitchen_id: string;
  servings_per_drop: number;
  delivery_address: string;
  cadence: "daily" | "weekly";
  weeks: number;
  ngo_name: string;
  dietary_notes?: string;
}): Promise<ToolResult> {
  await delay();
  const perMeal = 70;
  const perDrop = input.servings_per_drop * perMeal;
  // FIX: correctly calculate total drops for both cadences
  const dropsPerWeek = input.cadence === "daily" ? 7 : 1;
  const totalDrops = input.weeks * dropsPerWeek;
  const totalMeals = input.servings_per_drop * totalDrops;
  return {
    ok: true,
    data: {
      program_id: `FD-MP-${Date.now()}`,
      ngo: input.ngo_name,
      per_drop_inr: perDrop,
      total_program_inr: perDrop * totalDrops,
      total_drops: totalDrops,
      total_meals: totalMeals,
      first_delivery: getNextMonday() + " · 9:00 AM",
      dietary_notes: input.dietary_notes ?? "none",
    },
  };
}

// ─── Food: track_food_order ───────────────────────────────────────────────────
export async function track_food_order(input: {
  program_id: string;
}): Promise<ToolResult> {
  await delay(300);
  return {
    ok: true,
    data: {
      program_id: input.program_id,
      status: "out_for_delivery",
      kitchen_dispatched_at: getNextMonday() + " · 8:35 AM",
      eta: getNextMonday() + " · 9:05 AM",
      rider: "Suresh M.",
      live_tracking_url: `https://swiggy.com/track/${input.program_id}`,
      delivery_confirmation: "NGO staff notified via WhatsApp",
    },
  };
}

// ─── Dineout: search + get_available_slots + book_table ──────────────────────
export async function dineout_community_table(input: {
  location: string;
  party_size: number;
  date: string;
  occasion: string;
  dietary?: string;
}): Promise<ToolResult> {
  await delay();
  return {
    ok: true,
    data: {
      booking_id: `DO-${Date.now()}`,
      reservations: [
        { restaurant: "Saravana Bhavan", capacity: 60, csr_partner_discount_pct: 25, available: true },
        { restaurant: "Haldiram's", capacity: 80, csr_partner_discount_pct: 20, available: true },
      ],
      booked_restaurant: "Saravana Bhavan",
      confirmed_party_size: input.party_size,
      date: input.date,
      occasion: input.occasion,
    },
  };
}

// ─── Dineout: get_booking_status ──────────────────────────────────────────────
export async function get_dineout_booking_status(input: {
  booking_id: string;
}): Promise<ToolResult> {
  await delay(200);
  return {
    ok: true,
    data: {
      booking_id: input.booking_id,
      status: "confirmed",
      restaurant: "Saravana Bhavan",
      confirmation_code: `DINEOUT-${input.booking_id.slice(-6)}`,
      message: "Table confirmed. Restaurant manager notified. Arrival instructions sent to NGO coordinator.",
    },
  };
}

// ─── Our product layer ────────────────────────────────────────────────────────
export async function csr_budget_status(input: {
  corporate_id: string;
}): Promise<ToolResult> {
  await delay(100);
  // Simulated budget for demo — in production this comes from our DB
  const budget_total = 400000;
  const budget_spent = 148000;
  const budget_remaining = budget_total - budget_spent;
  const utilization_pct = Math.round((budget_spent / budget_total) * 100);
  const today = new Date();
  const yearEnd = new Date(today.getFullYear(), 2, 31); // March 31
  if (yearEnd < today) yearEnd.setFullYear(yearEnd.getFullYear() + 1);
  const days_to_year_end = Math.ceil((yearEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const daily_pace_needed = Math.round(budget_remaining / days_to_year_end);
  return {
    ok: true,
    data: {
      corporate_id: input.corporate_id,
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

export async function schedule_program(input: {
  program_name: string;
  ngo_name: string;
  total_budget_inr: number;
  cadence: "weekly" | "biweekly" | "monthly";
  components: { type: string; budget_inr: number; description: string }[];
}): Promise<ToolResult> {
  await delay(200);
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
      confirmation_message: `📋 *${input.program_name}* scheduled.\n` +
        `• NGO: ${input.ngo_name}  •  Budget: ₹${input.total_budget_inr.toLocaleString("en-IN")}  •  Cadence: ${input.cadence}\n` +
        `• Next run: ${getNextSaturday()}\n\n` +
        `Before each run, you'll receive a confirmation prompt. Execution will proceed automatically if no response within 24h.`,
    },
  };
}

export async function generate_80g_receipt(input: {
  corporate_name: string;
  pan: string;
  amount_inr: number;
  beneficiary_ngo: string;
  ngo_80g_reg: string;
}): Promise<ToolResult> {
  await delay();
  const receipt_id = `80G-${Date.now()}`;
  return {
    ok: true,
    data: {
      receipt_id,
      pdf_url: `/receipts/80g-${receipt_id}.pdf`,
      tax_deductible_inr: input.amount_inr,
      compliance: "Section 80G(5)(vi) — verified",
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
      co2_saved_kg: Math.round(input.meals_served * 0.4),
      esg_score_delta: "+0.8",
      photo_proof_pending_ngo_upload: true,
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getNextSaturday(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function getNextMonday(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((1 - d.getDay() + 7) % 7 || 7));
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export const toolImpls = {
  instamart_search_bulk,
  instamart_schedule_recurring,
  track_instamart_order,
  food_partner_kitchens,
  fetch_food_coupons,
  apply_food_coupon,
  food_schedule_meal_program,
  track_food_order,
  dineout_community_table,
  get_dineout_booking_status,
  csr_budget_status,
  schedule_program,
  generate_80g_receipt,
  impact_dashboard_update,
} as const;

export type ToolName = keyof typeof toolImpls;
