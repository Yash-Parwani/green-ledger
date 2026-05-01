import OpenAI from "openai";

export const tools: OpenAI.Chat.ChatCompletionTool[] = [
  // ─── Instamart ───────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "instamart_search_bulk",
      description: "Find bulk staples on Swiggy Instamart at best per-kg price. Maps to Instamart search_products MCP.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["rice", "dal", "oil", "wheat", "salt", "spices"] },
          quantity_kg: { type: "number" },
          location: { type: "string" },
        },
        required: ["category", "quantity_kg", "location"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "instamart_schedule_recurring",
      description: "Schedule a recurring bulk-staples drop to an NGO. Our product layer on top of Instamart update_cart + checkout MCPs.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                category: { type: "string" },
                quantity_kg: { type: "number" },
                vendor: { type: "string" },
                price_per_kg_inr: { type: "number" },
              },
              required: ["category", "quantity_kg", "vendor", "price_per_kg_inr"],
            },
          },
          delivery_address: { type: "string" },
          cadence: { type: "string", enum: ["weekly", "biweekly", "monthly"] },
          weeks: { type: "integer" },
          ngo_name: { type: "string" },
        },
        required: ["items", "delivery_address", "cadence", "weeks", "ngo_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "track_instamart_order",
      description: "Track the first drop of a scheduled Instamart program. Maps to Instamart track_order MCP.",
      parameters: {
        type: "object",
        properties: {
          schedule_id: { type: "string" },
        },
        required: ["schedule_id"],
      },
    },
  },
  // ─── Food ────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "food_partner_kitchens",
      description: "Find FSSAI-certified partner kitchens for scale meals. Maps to Food search_restaurants MCP.",
      parameters: {
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
  },
  {
    type: "function",
    function: {
      name: "fetch_food_coupons",
      description: "Fetch bulk/B2B Swiggy Food coupons. ALWAYS call before placing a food order to maximise CSR efficiency. Maps to Food fetch_food_coupons MCP.",
      parameters: {
        type: "object",
        properties: {
          kitchen_id: { type: "string" },
          order_value_inr: { type: "number" },
        },
        required: ["kitchen_id", "order_value_inr"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "apply_food_coupon",
      description: "Apply a coupon to the Swiggy Food order. Call after fetch_food_coupons returns an applicable code. Maps to Food apply_food_coupon MCP.",
      parameters: {
        type: "object",
        properties: {
          kitchen_id: { type: "string" },
          coupon_code: { type: "string" },
          order_value_inr: { type: "number" },
        },
        required: ["kitchen_id", "coupon_code", "order_value_inr"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "food_schedule_meal_program",
      description: "Schedule a recurring cooked-meal program. Our product layer on top of Food place_food_order MCP.",
      parameters: {
        type: "object",
        properties: {
          kitchen_id: { type: "string" },
          servings_per_drop: { type: "integer" },
          delivery_address: { type: "string" },
          cadence: { type: "string", enum: ["daily", "weekly"] },
          weeks: { type: "integer" },
          ngo_name: { type: "string" },
          dietary_notes: { type: "string" },
        },
        required: ["kitchen_id", "servings_per_drop", "delivery_address", "cadence", "weeks", "ngo_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "track_food_order",
      description: "Track delivery status of a scheduled Food meal drop. Maps to Food track_food_order MCP. Call after food_schedule_meal_program.",
      parameters: {
        type: "object",
        properties: {
          program_id: { type: "string" },
        },
        required: ["program_id"],
      },
    },
  },
  // ─── Dineout ─────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "dineout_community_table",
      description: "Reserve community-table slots for festival meals. Wraps Dineout search + get_available_slots + book_table MCPs.",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string" },
          party_size: { type: "integer" },
          date: { type: "string" },
          occasion: { type: "string" },
          dietary: { type: "string" },
        },
        required: ["location", "party_size", "date", "occasion"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_dineout_booking_status",
      description: "Confirm a Dineout community table reservation. Maps to Dineout get_booking_status MCP.",
      parameters: {
        type: "object",
        properties: {
          booking_id: { type: "string" },
        },
        required: ["booking_id"],
      },
    },
  },
  // ─── Our product layer ────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "csr_budget_status",
      description: "OUR LAYER. Check CSR budget: total, spent, remaining, utilization %, days to year-end. Call first when user mentions a budget or asks to deploy funds.",
      parameters: {
        type: "object",
        properties: {
          corporate_id: { type: "string" },
        },
        required: ["corporate_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_program",
      description: "OUR LAYER. Register the full CSR program into the recurring scheduler. Returns next-run date and sends a pre-execution confirmation to the CSR admin.",
      parameters: {
        type: "object",
        properties: {
          program_name: { type: "string" },
          ngo_name: { type: "string" },
          total_budget_inr: { type: "number" },
          cadence: { type: "string", enum: ["weekly", "biweekly", "monthly"] },
          components: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["instamart_staples", "food_meals", "dineout_tables"] },
                budget_inr: { type: "number" },
                description: { type: "string" },
              },
              required: ["type", "budget_inr", "description"],
            },
          },
        },
        required: ["program_name", "ngo_name", "total_budget_inr", "cadence", "components"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_80g_receipt",
      description: "OUR LAYER. Generate a Section 80G-compliant donation receipt PDF.",
      parameters: {
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
  },
  {
    type: "function",
    function: {
      name: "impact_dashboard_update",
      description: "OUR LAYER. Update CSR impact dashboard with meals served, cost-per-meal, CO2 saved, ESG-score delta.",
      parameters: {
        type: "object",
        properties: {
          program_id: { type: "string" },
          meals_served: { type: "integer" },
          beneficiary_ngo: { type: "string" },
          amount_spent_inr: { type: "number" },
          coupon_savings_inr: { type: "number" },
        },
        required: ["program_id", "meals_served", "beneficiary_ngo", "amount_spent_inr"],
      },
    },
  },
];

export const systemPrompt = `You are **Second Helping**, an autonomous CSR procurement agent. You help Indian corporates deploy their mandatory 2% Section 135 CSR budget into recurring meal-sponsorship programs for vetted NGOs and shelters.

You have access to:
- **Swiggy Instamart MCP** (search_products, update_cart, checkout, track_order) — bulk staples at wholesale
- **Swiggy Food MCP** (search_restaurants, fetch_food_coupons, apply_food_coupon, place_food_order, track_food_order) — FSSAI partner kitchens
- **Swiggy Dineout MCP** (search + slots + book_table + get_booking_status) — community tables
- **Our product layer**: csr_budget_status, schedule_program, generate_80g_receipt, impact_dashboard_update

## Agent flow — follow this sequence every time

1. **Budget check first**: Call csr_budget_status. Surface utilization % and days-to-year-end. Warn if <60% utilized with <120 days left.
2. **Propose split**: ~70% Instamart bulk staples (biweekly) + ~30% Food cooked meals (weekly). Dineout for festival weeks.
3. **Coupon stack**: Before any Food order, call fetch_food_coupons, then apply_food_coupon if a code applies. Report savings.
4. **Execute + confirm**: After scheduling, call track_instamart_order / track_food_order / get_dineout_booking_status to confirm delivery is in motion.
5. **Register recurring**: Call schedule_program to persist the full program in the cron scheduler.
6. **Compliance close**: generate_80g_receipt + impact_dashboard_update.

Speak like a CSR analyst — tight Slack bullets, INR figures, compliance deadlines. Bold key numbers. Always surface: total deployed, ₹/meal, next-drop date, utilization % remaining.`;
