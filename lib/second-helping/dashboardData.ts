import type { TrajEntry } from "@/components/ui/ToolTrajectory";

export type Budget = {
  total: number;
  spent: number;
  remaining: number;
  utilization_pct: number;
  days_left: number;
};

export type ActiveProgram = {
  program_id: string;
  program_name: string;
  ngo: string;
  cadence: string;
  total_budget_inr: number;
  next_run: string;
};

export type DashboardData = {
  // No co2 / esg field. Both were fabricated downstream of hardcoded constants
  // in impact_dashboard_update; cost_per_meal is derived from figures we
  // actually hold, so it survives an auditor asking where it came from.
  metrics: { meals: number; spent: number; ngos: number; costPerMeal: number; savings: number };
  budget: Budget | null;
  programs: ActiveProgram[];
};

export function buildDashboardData(trajectory: TrajEntry[]): DashboardData {
  let meals = 0;
  let spent = 0;
  let savings = 0;
  const ngos = new Set<string>();
  const programs: ActiveProgram[] = [];
  let budget: Budget | null = null;
  const seenPrograms = new Set<string>();

  for (const t of trajectory) {
    if (t.kind === "tool_use" && t.name === "impact_dashboard_update") {
      const i = t.input as { meals_served?: number; amount_spent_inr?: number; beneficiary_ngo?: string };
      meals += i.meals_served ?? 0;
      spent += i.amount_spent_inr ?? 0;
      if (i.beneficiary_ngo) ngos.add(i.beneficiary_ngo);
    }
    if (t.kind === "tool_result") {
      const o = (t.output as { ok?: boolean; data?: Record<string, unknown> }).data;
      if (!o) continue;
      if (typeof o.savings_inr === "number") savings += o.savings_inr;
      if (
        typeof o.budget_total_inr === "number" &&
        typeof o.budget_spent_inr === "number" &&
        typeof o.budget_remaining_inr === "number" &&
        typeof o.utilization_pct === "number" &&
        typeof o.days_to_year_end === "number"
      ) {
        budget = {
          total: o.budget_total_inr,
          spent: o.budget_spent_inr,
          remaining: o.budget_remaining_inr,
          utilization_pct: o.utilization_pct,
          days_left: o.days_to_year_end,
        };
      }
      if (o.program_id && o.program_name && o.next_run && !seenPrograms.has(o.program_id as string)) {
        seenPrograms.add(o.program_id as string);
        programs.push(o as unknown as ActiveProgram);
      }
    }
  }

  const costPerMeal = meals > 0 ? Math.round(spent / meals) : 0;

  return { metrics: { meals, spent, ngos: ngos.size, costPerMeal, savings }, budget, programs };
}
