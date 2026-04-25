import OpenAI from "openai";

export const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "dineout_search_restaurants",
      description:
        "Search Swiggy Dineout for restaurants that can host a group. Use when the event has a venue requirement (dinner, lunch, formal gathering).",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "Neighbourhood or city" },
          cuisine: { type: "string", description: "Optional cuisine preference" },
          party_size: { type: "integer" },
          date: { type: "string", description: "ISO date, e.g. 2026-05-03" },
        },
        required: ["location", "party_size", "date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "dineout_reserve",
      description: "Book a specific Dineout slot once the user confirms.",
      parameters: {
        type: "object",
        properties: {
          restaurant_id: { type: "string" },
          party_size: { type: "integer" },
          date: { type: "string" },
          time: { type: "string" },
          host_name: { type: "string" },
        },
        required: ["restaurant_id", "party_size", "date", "time", "host_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "food_search_restaurants",
      description:
        "Search Swiggy Food for delivery restaurants. Use for catering to a home venue, or overflow items the Dineout venue can't cover.",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string" },
          cuisine: { type: "string" },
          dietary: {
            type: "array",
            items: { type: "string" },
            description: "e.g. ['veg','jain','nut-free']",
          },
        },
        required: ["location"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "food_create_group_order",
      description:
        "Place a group order on Swiggy Food. Automatically splits payment via UPI collect to every guest and consolidates into one drop.",
      parameters: {
        type: "object",
        properties: {
          restaurant_id: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                quantity: { type: "integer" },
                notes: { type: "string" },
              },
              required: ["name", "quantity"],
            },
          },
          delivery_address: { type: "string" },
          delivery_time: { type: "string" },
          split_payment_among: {
            type: "integer",
            description: "Number of guests to split the bill across",
          },
        },
        required: [
          "restaurant_id",
          "items",
          "delivery_address",
          "delivery_time",
          "split_payment_among",
        ],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "instamart_search",
      description: "Search Swiggy Instamart for party supplies: decor, drinks, ice, disposables.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          location: { type: "string" },
        },
        required: ["query", "location"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "instamart_add_to_cart",
      description: "Add supplies to Instamart cart and schedule delivery to the venue.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                quantity: { type: "integer" },
              },
              required: ["id", "quantity"],
            },
          },
          delivery_address: { type: "string" },
          delivery_time: { type: "string" },
        },
        required: ["items", "delivery_address", "delivery_time"],
      },
    },
  },
];

export const systemPrompt = `You are **The Group Concierge**, an AI event planner powered by Swiggy's Food, Instamart, and Dineout MCP servers.

Your job: take a single natural-language brief from a host (housewarming, kitty party, society meetup, birthday, offsite) and orchestrate the full event across all three surfaces.

How you work:
1. Clarify only what's blocking (date, headcount, budget, location, dietary mix). Don't over-interrogate.
2. Propose a plan before booking anything. Show the user what you intend to do across Dineout / Food / Instamart with rough costs.
3. Once they confirm, execute the bookings via the tools and return a clean summary with reservation IDs, order IDs, UPI collect status, and delivery ETAs.
4. Prefer one coordinated drop (Food + Instamart aligned to venue arrival time) over many fragmented deliveries.

Keep responses tight. Use short markdown lists. Assume the user is on a phone.`;
