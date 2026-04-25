// Mock Swiggy MCP clients. Replace each function body with real MCP calls
// once Swiggy Builders Club grants access. Tool names/schemas mirror what
// we expect the real Food/Instamart/Dineout MCP servers to expose.

type ToolResult = { ok: true; data: unknown } | { ok: false; error: string };

const delay = (ms = 180) => new Promise((r) => setTimeout(r, ms));

// ---------- Dineout ----------
export async function dineout_search_restaurants(input: {
  location: string;
  cuisine?: string;
  party_size: number;
  date: string;
}): Promise<ToolResult> {
  await delay();
  return {
    ok: true,
    data: {
      results: [
        { id: "do_1", name: "Bastian Bandra", cuisine: "Asian fusion", capacity: 40, price_per_head: 1800, available_slots: ["19:30", "20:30", "21:30"] },
        { id: "do_2", name: "The Tasting Room", cuisine: "European", capacity: 30, price_per_head: 2200, available_slots: ["19:00", "20:00"] },
        { id: "do_3", name: "Pali Village Cafe", cuisine: "Continental", capacity: 50, price_per_head: 1500, available_slots: ["19:00", "20:30"] },
      ],
      query: input,
    },
  };
}

export async function dineout_reserve(input: {
  restaurant_id: string;
  party_size: number;
  date: string;
  time: string;
  host_name: string;
}): Promise<ToolResult> {
  await delay();
  return {
    ok: true,
    data: { reservation_id: `DO-${Date.now()}`, status: "CONFIRMED", ...input },
  };
}

// ---------- Food ----------
export async function food_search_restaurants(input: {
  location: string;
  cuisine?: string;
  dietary?: string[];
}): Promise<ToolResult> {
  await delay();
  return {
    ok: true,
    data: {
      results: [
        { id: "f_1", name: "Bohri Kitchen", cuisine: "Bohri", rating: 4.7, eta_min: 35, avg_per_plate: 450 },
        { id: "f_2", name: "Burma Burma", cuisine: "Burmese", rating: 4.6, eta_min: 40, avg_per_plate: 520 },
        { id: "f_3", name: "Theobroma", cuisine: "Desserts", rating: 4.5, eta_min: 25, avg_per_plate: 280 },
      ],
    },
  };
}

export async function food_create_group_order(input: {
  restaurant_id: string;
  items: { name: string; quantity: number; notes?: string }[];
  delivery_address: string;
  delivery_time: string;
  split_payment_among: number;
}): Promise<ToolResult> {
  await delay();
  const total = input.items.reduce((s, i) => s + i.quantity * 450, 0);
  return {
    ok: true,
    data: {
      order_id: `FD-${Date.now()}`,
      total_inr: total,
      per_person_inr: Math.round(total / input.split_payment_among),
      upi_collect_links_sent: input.split_payment_among,
      eta: input.delivery_time,
    },
  };
}

// ---------- Instamart ----------
export async function instamart_search(input: { query: string; location: string }): Promise<ToolResult> {
  await delay();
  const catalog: Record<string, { id: string; name: string; price: number; unit: string }[]> = {
    decor: [
      { id: "im_1", name: "LED fairy lights (10m)", price: 249, unit: "pack" },
      { id: "im_2", name: "Balloon arch kit", price: 599, unit: "kit" },
    ],
    drinks: [
      { id: "im_3", name: "Coca-Cola 2L", price: 110, unit: "bottle" },
      { id: "im_4", name: "Bisleri water 1L x12", price: 240, unit: "pack" },
    ],
    ice: [{ id: "im_5", name: "Ice cubes 2kg", price: 80, unit: "pack" }],
    disposables: [{ id: "im_6", name: "Paper plates (50 ct)", price: 180, unit: "pack" }],
  };
  const key = Object.keys(catalog).find((k) => input.query.toLowerCase().includes(k)) ?? "decor";
  return { ok: true, data: { results: catalog[key], query: input } };
}

export async function instamart_add_to_cart(input: {
  items: { id: string; quantity: number }[];
  delivery_address: string;
  delivery_time: string;
}): Promise<ToolResult> {
  await delay();
  const subtotal = input.items.reduce((s, i) => s + i.quantity * 220, 0);
  return {
    ok: true,
    data: { cart_id: `IM-${Date.now()}`, subtotal_inr: subtotal, delivery_fee_inr: 49, eta: input.delivery_time },
  };
}

export const toolImpls = {
  dineout_search_restaurants,
  dineout_reserve,
  food_search_restaurants,
  food_create_group_order,
  instamart_search,
  instamart_add_to_cart,
} as const;

export type ToolName = keyof typeof toolImpls;
