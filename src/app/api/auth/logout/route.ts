import { cookies } from "next/headers";
import { siteOrigin } from "@/lib/openid";
import { SESSION_COOKIE } from "@/lib/session";

/** POST, kad atsijungimo nebutu galima iskviesti paprasta nuoroda is kitos svetaines */
export async function POST(request: Request) {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  return Response.redirect(`${siteOrigin(request)}/`, 303);
}
