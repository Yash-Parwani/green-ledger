import { clearSwiggyToken, SWIGGY_BASE_URL, getValidSwiggyToken } from "@/lib/shared/swiggy-auth";

export const runtime = "nodejs";

export async function POST() {
  const token = await getValidSwiggyToken();
  if (token) {
    try {
      await fetch(`${SWIGGY_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // best-effort — clear the local cookie regardless
    }
  }
  await clearSwiggyToken();
  return Response.json({ ok: true });
}
