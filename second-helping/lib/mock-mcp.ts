// Mock Swiggy MCP clients for the CSR procurement use case.
// Same MCP surface as Group Concierge, but specialized to bulk staples,
// partner kitchens, and community-table reservations for NGO meal sponsorship.

type ToolResult = { ok: true; data: unknown } | { ok: false; error: string };
const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));

// ---------- Instamart: bulk staples ----------
export async function instamart_search_bulk(input: {
  category: "rice" | "dal" | "oil" | "wheat" | "salt" | "spices";
  quantity_kg: number;
  location: string;
}): Promise<ToolResult> {
  await delay();
  const prices: Record<string, number> = { rice: 62, dal: 110, oil: 145, wheat: 38, salt: 22, spices: 280 };
  const unit = prices[input.category] ?? 80;
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

export async function instamart_schedule_recurring(input: {
  items: { category: string; quantity_kg: number; vendor: string }[];
  delivery_address: string;
  cadence: "weekly" | "biweekly" | "monthly";
  weeks: number;
}): Promise<ToolResult> {
  await delay();
  const total = input.items.reduce((s, i) => s + i.quantity_kg * 80, 0);
  return {
    ok: true,
    data: {
      schedule_id: `IM-RC-${Date.now()}`,
      total_per_drop_inr: total,
      total_program_inr: total * input.weeks,
      drops_scheduled: input.weeks,
      next_delivery: "Saturday, 11:00 AM",
    },
  };
}

// ---------- Food: partner kitchens for cooked meals ----------
export async function food_partner_kitchens(input: {
  location: string;
  meal_type: "north_indian" | "south_indian" | "khichdi" | "biryani";
  servings: number;
  dietary?: string[];
}): Promise<ToolResult> {
  await delay();
  return {
    ok: true,
    data: {
      kitchens: [
        { id: "pk_1", name: "Annapurna Community Kitchen", per_meal_inr: 65, capacity_per_day: 800, certified_fssai: true },
        { id: "pk_2", name: "Akshaya Kitchen Co.", per_meal_inr: 78, capacity_per_day: 1500, certified_fssai: true },
      ],
      query: input,
    },
  };
}

export async function food_schedule_meal_program(input: {
  kitchen_id: string;
  servings_per_drop: number;
  delivery_address: string;
  cadence: "daily" | "weekly";
  weeks: number;
}): Promise<ToolResult> {
  await delay();
  const perDrop = input.servings_per_drop * 70;
  return {
    ok: true,
    data: {
      program_id: `FD-MP-${Date.now()}`,
      per_drop_inr: perDrop,
      total_program_inr: perDrop * input.weeks * (input.cadence === "daily" ? 7 : 1),
      meals_per_program: input.servings_per_drop * input.weeks * (input.cadence === "daily" ? 7 : 1),
    },
  };
}

// ---------- Dineout: community tables for festivals ----------
export async function dineout_community_table(input: {
  location: string;
  party_size: number;
  date: string;
  occasion: string;
}): Promise<ToolResult> {
  await delay();
  return {
    ok: true,
    data: {
      reservations_available: [
        { restaurant: "Saravana Bhavan", capacity: 60, csr_partner_discount_pct: 25, available: true },
        { restaurant: "Haldiram's", capacity: 80, csr_partner_discount_pct: 20, available: true },
      ],
      query: input,
    },
  };
}

// ---------- CSR layer (this is OUR product, not Swiggy's) ----------
export async function generate_80g_receipt(input: {
  corporate_name: string;
  pan: string;
  amount_inr: number;
  beneficiary_ngo: string;
  ngo_80g_reg: string;
}): Promise<ToolResult> {
  await delay();
  return {
    ok: true,
    data: {
      receipt_id: `80G-${Date.now()}`,
      pdf_url: `/receipts/80g-${Date.now()}.pdf`,
      tax_deductible_inr: input.amount_inr,
      compliance: "Section 80G(5)(vi) — verified",
    },
  };
}

export async function impact_dashboard_update(input: {
  program_id: string;
  meals_served: number;
  beneficiary_ngo: string;
  amount_spent_inr: number;
}): Promise<ToolResult> {
  await delay();
  const cost_per_meal = input.amount_spent_inr / input.meals_served;
  return {
    ok: true,
    data: {
      updated: true,
      meals_served: input.meals_served,
      cost_per_meal_inr: Math.round(cost_per_meal * 100) / 100,
      co2_saved_kg: Math.round(input.meals_served * 0.4),
      esg_score_delta: "+0.8",
      photo_proof_pending_ngo_upload: true,
    },
  };
}

export const toolImpls = {
  instamart_search_bulk,
  instamart_schedule_recurring,
  food_partner_kitchens,
  food_schedule_meal_program,
  dineout_community_table,
  generate_80g_receipt,
  impact_dashboard_update,
} as const;

export type ToolName = keyof typeof toolImpls;
