import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { STATE_COOKIE, buildLoginUrl, siteOrigin } from "@/lib/openid";

/** Nukreipia i oficialu Steam prisijungimo puslapi */
export async function GET(request: Request) {
  const state = randomBytes(16).toString("base64url");
  const store = await cookies();
  store.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/steam",
    maxAge: 600,
  });
  return Response.redirect(buildLoginUrl(siteOrigin(request), state), 302);
}
