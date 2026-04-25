import Anthropic from "@anthropic-ai/sdk";

export const tools: Anthropic.Tool[] = [
  {
    name: "instamart_search_bulk",
    description: "Find bulk staples (rice, dal, oil, wheat, salt, spices) on Swiggy Instamart at the best per-kg price near a location.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string", enum: ["rice", "dal", "oil", "wheat", "salt", "spices"] },
        quantity_kg: { type: "number" },
        location: { type: "string" },
      },
      required: ["category", "quantity_kg", "location"],
    },
  },
  {
    name: "instamart_schedule_recurring",
    description: "Schedule a recurring bulk-staples drop to an NGO/shelter address.",
    input_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: { category: { type: "string" }, quantity_kg: { type: "number" }, vendor: { type: "string" } },
            required: ["category", "quantity_kg", "vendor"],
          },
        },
        delivery_address: { type: "string" },
        cadence: { type: "string", enum: ["weekly", "biweekly", "monthly"] },
        weeks: { type: "integer", description: "Total program duration in weeks" },
      },
      required: ["items", "delivery_address", "cadence", "weeks"],
    },
  },
  {
    name: "food_partner_kitchens",
    description: "Find FSSAI-certified partner kitchens on Swiggy Food that can cook meals at scale for shelter/NGO meal programs.",
    input_schema: {
      type: "object",
      properties: {
        location: { type: "string" },
        meal_type: { type: "string", enum: ["north_indian", "south_indian", "khichdi", "biryani"] },
        servings: { type: "integer" },
        dietary: { type: "array", items: { type: "string" } },
      },
      required: ["location", "meal_type", "servings"],
    },
  },
  {
    name: "food_schedule_meal_program",
    description: "Schedule a recurring cooked-meal program with a partner kitchen, dropped at the NGO address.",
    input_schema: {
      type: "object",
      properties: {
        kitchen_id: { type: "string" },
        servings_per_drop: { type: "integer" },
        delivery_address: { type: "string" },
        cadence: { type: "string", enum: ["daily", "weekly"] },
        weeks: { type: "integer" },
      },
      required: ["kitchen_id", "servings_per_drop", "delivery_address", "cadence", "weeks"],
    },
  },
  {
    name: "dineout_community_table",
    description: "Reserve community-table slots at participating restaurants for festival meals (Diwali, Christmas, Eid) for shelter beneficiaries.",
    input_schema: {
      type: "object",
      properties: {
        location: { type: "string" },
        party_size: { type: "integer" },
        date: { type: "string" },
        occasion: { type: "string" },
      },
      required: ["location", "party_size", "date", "occasion"],
    },
  },
  {
    name: "generate_80g_receipt",
    description: "Generate a Section 80G-compliant donation receipt PDF for the corporate's CSR records. THIS IS OUR PRODUCT LAYER, not Swiggy.",
    input_schema: {
      type: "object",
      properties: {
        corporate_name: { type: "string" },
        pan: { type: "string" },
        amount_inr: { type: "number" },
        beneficiary_ngo: { type: "string" },
        ngo_80g_reg: { type: "string" },
      },
      required: ["corporate_name", "pan", "amount_inr", "beneficiary_ngo", "ngo_80g_reg"],
    },
  },
  {
    name: "impact_dashboard_update",
    description: "Update the corporate's CSR impact dashboard with meals served, cost-per-meal, CO2 saved, ESG-score delta. OUR PRODUCT LAYER.",
    input_schema: {
      type: "object",
      properties: {
        program_id: { type: "string" },
        meals_served: { type: "integer" },
        beneficiary_ngo: { type: "string" },
        amount_spent_inr: { type: "number" },
      },
      required: ["program_id", "meals_served", "beneficiary_ngo", "amount_spent_inr"],
    },
  },
];

export const systemPrompt = `You are **Second Helping**, an autonomous CSR procurement agent. You help Indian corporates deploy their mandatory 2% Section 135 CSR budget into recurring meal-sponsorship programs for vetted NGOs and shelters.

You have access to:
- Swiggy Instamart MCP (bulk staples — rice, dal, oil — at wholesale prices)
- Swiggy Food MCP (FSSAI-certified partner kitchens for cooked meals)
- Swiggy Dineout MCP (community-table reservations at participating restaurants for festival meals)
- An internal compliance layer (80G receipt generation, ESG impact dashboard updates) — these are YOUR product, not Swiggy's.

How you work:
1. The user is typically a CFO, CSR head, or admin in a Slack/Teams thread. They give you a budget, beneficiary NGO, geography, and cadence.
2. Propose a smart split between bulk staples (cheap calories, biweekly) and cooked meals (FSSAI-certified, daily/weekly drops). Allocate ~70% staples, ~30% cooked meals as a default; tune based on the brief.
3. For festival weeks, add Dineout community-table reservations.
4. Once approved, execute via the MCPs, then call generate_80g_receipt and impact_dashboard_update so the corporate has compliance + ESG artifacts on day one.
5. Speak like a CSR analyst, not a foodie. Numbers, compliance, deadlines.

Keep messages crisp — these go into a Slack thread. Use bullet lists with INR figures.`;
