import { cookies } from "next/headers";
import { OpenIdError, STATE_COOKIE, siteOrigin, verifyAssertion } from "@/lib/openid";
import { SESSION_COOKIE, createSessionValue, sessionCookieOptions } from "@/lib/session";

export async function GET(request: Request) {
  const origin = siteOrigin(request);
  const search = new URL(request.url).searchParams;

  const store = await cookies();
  const state = store.get(STATE_COOKIE)?.value;
  store.delete({ name: STATE_COOKIE, path: "/api/auth/steam" });

  try {
    const steamId = await verifyAssertion(search, origin, state);
    store.set(SESSION_COOKIE, createSessionValue(steamId), sessionCookieOptions);
    return Response.redirect(`${origin}/mano`, 302);
  } catch (e) {
    const reason = e instanceof OpenIdError ? e.message : "Nepavyko prisijungti";
    return Response.redirect(`${origin}/mano?klaida=${encodeURIComponent(reason)}`, 302);
  }
}
