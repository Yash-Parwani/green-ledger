import { isSwiggyConnected, isSwiggyMcpEnabled } from "@/lib/shared/swiggy-auth";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    enabled: isSwiggyMcpEnabled(),
    connected: await isSwiggyConnected(),
  });
}
