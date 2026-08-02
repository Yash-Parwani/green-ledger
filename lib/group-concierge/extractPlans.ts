import type { TrajEntry } from "@/components/ui/ToolTrajectory";
import type { PlanOption } from "@/components/ui/PlanCard";

type Extracted = { toolId: string; label: string; accent: "orange" | "green"; options: PlanOption[] };

export function extractPlanCards(trajectory: TrajEntry[]): Extracted[] {
  const cards: Extracted[] = [];

  for (const entry of trajectory) {
    if (entry.kind !== "tool_result") continue;
    const use = trajectory.find(
      (t): t is Extract<TrajEntry, { kind: "tool_use" }> => t.kind === "tool_use" && t.id === entry.id
    );
    if (!use) continue;
    const output = entry.output as { ok?: boolean; data?: Record<string, unknown> };
    if (!output?.ok || !output.data) continue;

    if (use.name === "dineout_search_restaurants") {
      const results = (output.data.results ?? []) as {
        id: string;
        name: string;
        cuisine: string;
        capacity: number;
        price_per_head: number;
        available_slots: string[];
      }[];
      cards.push({
        toolId: entry.id,
        label: "Venue · Dineout",
        accent: "orange",
        options: results.map((r) => ({
          id: r.id,
          title: r.name,
          subtitle: r.cuisine,
          meta: [`Seats ${r.capacity}`, r.available_slots?.[0] ? `Next slot ${r.available_slots[0]}` : ""].filter(
            Boolean
          ),
          price: `₹${r.price_per_head}/head`,
        })),
      });
    }

    if (use.name === "food_search_restaurants") {
      const results = (output.data.results ?? []) as {
        id: string;
        name: string;
        cuisine: string;
        rating: number;
        eta_min: number;
        avg_per_plate: number;
      }[];
      cards.push({
        toolId: entry.id,
        label: "Catering · Food",
        accent: "orange",
        options: results.map((r) => ({
          id: r.id,
          title: r.name,
          subtitle: r.cuisine,
          meta: [`★ ${r.rating}`, `${r.eta_min} min ETA`],
          price: `₹${r.avg_per_plate}/plate`,
        })),
      });
    }

    if (use.name === "instamart_search") {
      const results = (output.data.results ?? []) as { id: string; name: string; price: number; unit: string }[];
      cards.push({
        toolId: entry.id,
        label: "Supplies · Instamart",
        accent: "green",
        options: results.map((r) => ({
          id: r.id,
          title: r.name,
          price: `₹${r.price}/${r.unit}`,
        })),
      });
    }
  }

  // Keep only the most recent card per category so re-searches replace, not stack.
  const latestByLabel = new Map<string, Extracted>();
  for (const c of cards) latestByLabel.set(c.label, c);
  return Array.from(latestByLabel.values());
}
