import type { ToolSourceMap } from "@/components/ui/ToolTrajectory";

const instamart = { label: "Instamart", className: "bg-orange-100 text-orange-700" };
const food = { label: "Food", className: "bg-red-100 text-red-700" };
const dineout = { label: "Dineout", className: "bg-purple-100 text-purple-700" };
const ours = { label: "Our layer", className: "bg-green-100 text-green-700" };
const tax = { label: "GST", className: "bg-blue-100 text-blue-700" };

export const TOOL_SOURCE: ToolSourceMap = {
  instamart_search_bulk: instamart,
  instamart_schedule_recurring: instamart,
  track_instamart_order: instamart,
  food_partner_kitchens: food,
  fetch_food_coupons: food,
  apply_food_coupon: food,
  food_schedule_meal_program: food,
  track_food_order: food,
  dineout_community_table: dineout,
  get_dineout_booking_status: dineout,
  csr_budget_status: ours,
  schedule_program: ours,
  generate_80g_receipt: ours,
  generate_gst_invoice: tax,
  impact_dashboard_update: ours,
};
