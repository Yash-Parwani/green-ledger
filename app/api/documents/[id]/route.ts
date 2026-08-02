import { artifacts } from "@/lib/server/artifacts";
import { getSession } from "@/lib/server/session";

export const runtime = "nodejs";

/**
 * Serve a generated 80G receipt or GST invoice.
 *
 * Authorization is by session org, not by possession of the URL. The id is
 * unguessable, but "unguessable" is secrecy, not access control — these are
 * financial records naming a company, its PAN and its donees, and a link
 * pasted into a thread must not become a way to read another tenant's
 * paperwork.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new Response("Not signed in.", { status: 401 });

  const { id } = await params;
  const artifact = await artifacts.get(session.orgId, id);
  // Deliberately 404 rather than 403 for another tenant's document: a 403 would
  // confirm the id exists.
  if (!artifact) return new Response("Not found.", { status: 404 });

  return new Response(new Uint8Array(artifact.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${artifact.filename}"`,
      "Content-Length": String(artifact.bytes.length),
      // Financial records: don't let a shared proxy hold a copy.
      "Cache-Control": "private, no-store",
    },
  });
}
