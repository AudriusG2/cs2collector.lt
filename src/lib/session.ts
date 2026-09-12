import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Sesija be duomenu bazes: slapuke laikomas tik SteamID ir galiojimo laikas,
 * pasirasyti HMAC su SESSION_SECRET. Slaptazodziu ar Steam zetonu nesaugome —
 * Steam OpenID ju ir neduoda.
 *
 * Formatas: <steamId>.<galioja_iki_unix>.<parasas_base64url>
 */

export const SESSION_COOKIE = "cs2c_s";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dienu

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV !== "production") return "dev-only-secret-change-me-dev-only-secret";
  throw new Error("SESSION_SECRET nenustatytas arba per trumpas (reikia >= 32 simboliu)");
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function createSessionValue(steamId: string): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `${steamId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionValue(value: string | undefined): string | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [steamId, expRaw, sig] = parts;
  if (!/^7656119\d{10}$/.test(steamId)) return null;

  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return null;

  let expected: string;
  try {
    expected = sign(`${steamId}.${expRaw}`);
  } catch {
    return null;
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return steamId;
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE,
};

/** Grazina prisijungusio vartotojo SteamID arba null */
export async function getSessionSteamId(): Promise<string | null> {
  const store = await cookies();
  return verifySessionValue(store.get(SESSION_COOKIE)?.value);
}
