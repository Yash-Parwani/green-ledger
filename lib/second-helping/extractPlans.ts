import type { TrajEntry } from "@/components/ui/ToolTrajectory";
import type { PlanOption } from "@/components/ui/PlanCard";
import type { PaymentSimulatedLine } from "@/components/ui/PaymentSimulatedCard";

type Extracted = { toolId: string; label: string; accent: "orange" | "green"; options: PlanOption[] };

export type ExtractedPaymentSimulation = {
  toolId: string;
  label: string;
  accent: "orange" | "green";
  ngo?: string;
  lines: PaymentSimulatedLine[];
  perDrop?: string;
  total?: string;
  note: string;
};

/** A policy refusal that opened a proposal, surfaced inline so the approval
 *  happens where the agent raised it rather than in a panel off to the side. */
export type ExtractedApprovalRequest = {
  toolId: string;
  proposalId: string;
  reason: string;
  remedy: string;
};

export function extractApprovalRequests(trajectory: TrajEntry[]): ExtractedApprovalRequest[] {
  const found = new Map<string, ExtractedApprovalRequest>();

  for (const entry of trajectory) {
    if (entry.kind !== "tool_result") continue;
    const output = entry.output as {
      policy?: { code?: string; reason?: string; remedy?: string; proposal_id?: string };
    };
    const policy = output?.policy;
    if (policy?.code !== "APPROVAL_REQUIRED" || !policy.proposal_id) continue;

    // Keyed by proposal id: an agent that retries a blocked call gets the same
    // proposal back, and one pending decision should render once.
    found.set(policy.proposal_id, {
      toolId: entry.id,
      proposalId: policy.proposal_id,
      reason: policy.reason ?? "This commitment needs approval before it can execute.",
      remedy: policy.remedy ?? "",
    });
  }

  return Array.from(found.values());
}

export function extractPaymentSimulations(trajectory: TrajEntry[]): ExtractedPaymentSimulation[] {
  const cards: ExtractedPaymentSimulation[] = [];

  for (const entry of trajectory) {
    if (entry.kind !== "tool_result") continue;
    const use = trajectory.find(
      (t): t is Extract<TrajEntry, { kind: "tool_use" }> => t.kind === "tool_use" && t.id === entry.id
    );
    if (!use) continue;
    const output = entry.output as { ok?: boolean; data?: Record<string, unknown> };
    if (!output?.ok || !output.data?.payment_simulated) continue;

    if (use.name === "instamart_schedule_recurring") {
      const items = (output.data.items ?? []) as {
        category?: string;
        vendor?: string;
        price_per_kg_inr?: number;
        quantity_kg?: number;
      }[];
      cards.push({
        toolId: entry.id,
        label: "Recurring bulk drop · Instamart",
        accent: "green",
        ngo: output.data.ngo as string | undefined,
        lines: items.map((i) => ({
          label: `${i.category ?? "Item"}${i.vendor ? ` · ${i.vendor}` : ""}`,
          meta: i.quantity_kg ? `${i.quantity_kg}kg` : undefined,
          amount: i.price_per_kg_inr != null ? `₹${i.price_per_kg_inr}/kg` : undefined,
        })),
        perDrop: output.data.this_drop_inr != null ? `₹${(output.data.this_drop_inr as number).toLocaleString("en-IN")}` : undefined,
        total: output.data.programme_value_inr != null ? `₹${(output.data.programme_value_inr as number).toLocaleString("en-IN")}` : undefined,
        note: (output.data.payment_note as string) ?? "Checkout is simulated in this demo build.",
      });
    }

    if (use.name === "food_schedule_meal_program") {
      const menu = (output.data.menu ?? []) as { name?: string; quantity?: number; price_inr?: number }[];
      cards.push({
        toolId: entry.id,
        label: "Recurring meal program · Food",
        accent: "green",
        ngo: output.data.ngo as string | undefined,
        lines: menu.map((m) => ({
          label: m.name ?? "Dish",
          meta: m.quantity ? `×${m.quantity}` : undefined,
          amount: m.price_inr != null ? `₹${m.price_inr}` : undefined,
        })),
        perDrop: output.data.this_drop_inr != null ? `₹${(output.data.this_drop_inr as number).toLocaleString("en-IN")}` : undefined,
        total: output.data.programme_value_inr != null ? `₹${(output.data.programme_value_inr as number).toLocaleString("en-IN")}` : undefined,
        note: (output.data.payment_note as string) ?? "Checkout is simulated in this demo build.",
      });
    }
  }

  // Keep only the latest simulation per tool label so re-runs replace, not stack.
  const latestByLabel = new Map<string, ExtractedPaymentSimulation>();
  for (const c of cards) latestByLabel.set(c.label, c);
  return Array.from(latestByLabel.values());
}

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

    // Labels double as the dedupe key and the selection key, so they have to
    // identify the *search*, not just the surface. Two Instamart searches
    // (rice, then dal) both labelled "Bulk staples · Instamart" meant the
    // second silently replaced the first, and the user only ever saw the dal.
    const input = (use.input ?? {}) as Record<string, unknown>;

    if (use.name === "food_partner_kitchens") {
      const kitchens = (output.data.kitchens ?? []) as {
        id?: string;
        name?: string;
        dietary_compliance?: string[];
        per_meal_inr?: number;
        capacity_per_day?: number;
      }[];
      const mealType = typeof input.meal_type === "string" ? input.meal_type.replace(/_/g, " ") : null;
      cards.push({
        toolId: entry.id,
        label: mealType ? `${titleCase(mealType)} kitchens · Food` : "Kitchens · Food",
        accent: "green",
        options: kitchens.map((k, i) => ({
          id: k.id ?? String(i),
          title: stripAdSuffix(k.name) ?? "Kitchen",
          promoted: isPromoted(k.name),
          meta: [
            ...(k.dietary_compliance ?? []),
            ...(k.capacity_per_day ? [`Capacity ${k.capacity_per_day.toLocaleString("en-IN")}/day`] : []),
          ],
          price: k.per_meal_inr != null ? `₹${k.per_meal_inr}/meal` : undefined,
        })),
      });
    }

    if (use.name === "instamart_search_bulk") {
      const offers = (output.data.best_offers ?? []) as {
        vendor?: string;
        price_per_kg_inr?: number | null;
        bulk_discount_pct?: number;
        eta_hr?: number;
      }[];
      const category = typeof input.category === "string" ? input.category : null;
      cards.push({
        toolId: entry.id,
        label: category ? `${titleCase(category)} · Instamart` : "Bulk staples · Instamart",
        accent: "green",
        options: offers.map((o, i) => ({
          id: `${o.vendor ?? "vendor"}-${i}`,
          title: o.vendor ?? "Vendor",
          subtitle: o.bulk_discount_pct ? `${o.bulk_discount_pct}% bulk discount` : undefined,
          meta: o.eta_hr ? [`ETA ${o.eta_hr}h`] : [],
          price: o.price_per_kg_inr != null ? `₹${o.price_per_kg_inr}/kg` : undefined,
        })),
      });
    }

    if (use.name === "dineout_community_table") {
      const reservations = (output.data.reservations ?? []) as {
        restaurant?: string;
        restaurant_id?: string;
        capacity?: number;
        csr_partner_discount_pct?: number;
        cost_for_two_inr?: number;
      }[];
      cards.push({
        toolId: entry.id,
        label: "Community tables · Dineout",
        accent: "orange",
        options: reservations.map((r, i) => ({
          id: r.restaurant_id ?? `${r.restaurant ?? "restaurant"}-${i}`,
          title: r.restaurant ?? "Restaurant",
          subtitle: r.csr_partner_discount_pct ? `${r.csr_partner_discount_pct}% CSR partner discount` : undefined,
          meta: r.capacity ? [`Seats ${r.capacity}`] : [],
          price: r.cost_for_two_inr != null ? `₹${Math.round(r.cost_for_two_inr / 2)}/head` : undefined,
        })),
      });
    }
  }

  // Re-running the *same* search replaces its card; searching a different
  // staple or meal type adds one. That distinction lives in the label.
  const latestByLabel = new Map<string, Extracted>();
  for (const c of cards) latestByLabel.set(c.label, c);
  return Array.from(latestByLabel.values());
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Swiggy marks paid placements by appending "(Ad)" to the restaurant name, so
// the only signal arrives inside the display string. Pull it out into a real
// field rather than leaving it as punctuation the reader has to notice.
const AD_SUFFIX = /\s*\((?:ad|ads|sponsored)\)\s*$/i;

function isPromoted(name?: string): boolean {
  return !!name && AD_SUFFIX.test(name);
}

function stripAdSuffix(name?: string): string | undefined {
  return name?.replace(AD_SUFFIX, "").trim();
}
