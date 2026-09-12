import { steamFetch } from "./fetcher";

/**
 * Steam OpenID 2.0 — oficialus „Sign in through Steam".
 * Vartotojas prisijungia Steam puslapyje; mes gauname tik patvirtinta SteamID.
 * Jokio slaptazodzio ir jokios prieigos prie inventoriaus ar saugyklu.
 */

const OP_ENDPOINT = "https://steamcommunity.com/openid/login";
const NS = "http://specs.openid.net/auth/2.0";
const IDENTIFIER_SELECT = "http://specs.openid.net/auth/2.0/identifier_select";
const CLAIMED_ID_RE = /^https:\/\/steamcommunity\.com\/openid\/id\/(7656119\d{10})$/;
const NONCE_MAX_AGE_MS = 5 * 60 * 1000;

export function siteOrigin(request: Request): string {
  return (process.env.SITE_URL ?? new URL(request.url).origin).replace(/\/$/, "");
}

export function callbackUrl(origin: string): string {
  return `${origin}/api/auth/steam/callback`;
}

export function buildLoginUrl(origin: string): string {
  const params = new URLSearchParams({
    "openid.ns": NS,
    "openid.mode": "checkid_setup",
    "openid.return_to": callbackUrl(origin),
    "openid.realm": origin,
    "openid.identity": IDENTIFIER_SELECT,
    "openid.claimed_id": IDENTIFIER_SELECT,
  });
  return `${OP_ENDPOINT}?${params.toString()}`;
}

export class OpenIdError extends Error {}

/**
 * Patikrina Steam grazintus parametrus:
 *  1) vietines patikros (return_to, op_endpoint, claimed_id formatas, nonce senumas);
 *  2) parasa patvirtina pats Steam per check_authentication.
 */
export async function verifyAssertion(search: URLSearchParams, origin: string): Promise<string> {
  if (search.get("openid.mode") !== "id_res") throw new OpenIdError("Prisijungimas atšauktas");
  if (search.get("openid.op_endpoint") !== OP_ENDPOINT) throw new OpenIdError("Neteisingas tiekėjas");
  if (search.get("openid.return_to") !== callbackUrl(origin)) throw new OpenIdError("Neteisingas grįžimo adresas");

  const claimed = search.get("openid.claimed_id") ?? "";
  const identity = search.get("openid.identity") ?? "";
  const match = claimed.match(CLAIMED_ID_RE);
  if (!match || identity !== claimed) throw new OpenIdError("Neteisingas Steam identifikatorius");

  // Nonce: "2026-09-12T16:00:00Z<atsitiktinis>" — atmetam senus, kad sunkiau butu pakartoti
  const nonce = search.get("openid.response_nonce") ?? "";
  const ts = Date.parse(nonce.slice(0, 20));
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > NONCE_MAX_AGE_MS) {
    throw new OpenIdError("Prisijungimo nuoroda pasenusi — bandyk dar kartą");
  }

  const body = new URLSearchParams();
  for (const [k, v] of search) if (k.startsWith("openid.")) body.set(k, v);
  body.set("openid.mode", "check_authentication");

  const res = await steamFetch(OP_ENDPOINT, {
    method: "POST",
    body: body.toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "text/plain" },
    timeoutMs: 15_000,
  }).catch(() => null);

  const text = res ? await res.text().catch(() => "") : "";
  if (!/^is_valid\s*:\s*true\s*$/m.test(text)) throw new OpenIdError("Steam nepatvirtino prisijungimo");

  return match[1];
}
