import {
  buildAuthorizeUrl,
  generatePkce,
  getOrRegisterClientId,
  saveOauthAttempt,
} from "@/lib/shared/swiggy-auth";

export const runtime = "nodejs";

function redirectUri(req: Request): string {
  return process.env.SWIGGY_REDIRECT_URI || `${new URL(req.url).origin}/api/auth/swiggy/callback`;
}

export async function GET(req: Request) {
  const uri = redirectUri(req);
  const { codeVerifier, codeChallenge, state } = generatePkce();
  await saveOauthAttempt(state, codeVerifier);
  const clientId = await getOrRegisterClientId(uri);
  const url = buildAuthorizeUrl({ codeChallenge, state, redirectUri: uri, clientId });
  return Response.redirect(url, 302);
}
