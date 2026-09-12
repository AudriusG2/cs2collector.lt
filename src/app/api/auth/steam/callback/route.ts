import { cookies } from "next/headers";
import { OpenIdError, siteOrigin, verifyAssertion } from "@/lib/openid";
import { SESSION_COOKIE, createSessionValue, sessionCookieOptions } from "@/lib/session";

export async function GET(request: Request) {
  const origin = siteOrigin(request);
  const search = new URL(request.url).searchParams;

  try {
    const steamId = await verifyAssertion(search, origin);
    const store = await cookies();
    store.set(SESSION_COOKIE, createSessionValue(steamId), sessionCookieOptions);
    return Response.redirect(`${origin}/mano`, 302);
  } catch (e) {
    const reason = e instanceof OpenIdError ? e.message : "Nepavyko prisijungti";
    return Response.redirect(`${origin}/mano?klaida=${encodeURIComponent(reason)}`, 302);
  }
}
