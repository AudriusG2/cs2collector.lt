import { buildLoginUrl, siteOrigin } from "@/lib/openid";

/** Nukreipia i oficialu Steam prisijungimo puslapi */
export async function GET(request: Request) {
  return Response.redirect(buildLoginUrl(siteOrigin(request)), 302);
}
