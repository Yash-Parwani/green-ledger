import { consumeOauthAttempt, exchangeCodeForToken, saveSwiggyToken } from "@/lib/shared/swiggy-auth";

export const runtime = "nodejs";

function redirectUri(req: Request): string {
  return process.env.SWIGGY_REDIRECT_URI || `${new URL(req.url).origin}/api/auth/swiggy/callback`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const attempt = await consumeOauthAttempt();

  if (!code || !state || !attempt || attempt.state !== state) {
    return Response.redirect(`${url.origin}/console?swiggy=error`, 302);
  }

  try {
    const token = await exchangeCodeForToken({
      code,
      codeVerifier: attempt.codeVerifier,
      redirectUri: redirectUri(req),
    });
    await saveSwiggyToken(token);
    return Response.redirect(`${url.origin}/console?swiggy=connected`, 302);
  } catch {
    return Response.redirect(`${url.origin}/console?swiggy=error`, 302);
  }
}
