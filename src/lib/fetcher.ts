import { ProxyAgent } from "undici";

/**
 * Steam riboja uzklausas pagal IP, o debesu tiekeju (taip pat ir Vercel)
 * adresai blokuojami visiskai. Palaikomi du proxy budai:
 *
 *  1. STEAM_PROXY_HTTP  — iprastas HTTP/HTTPS proxy su prisijungimais,
 *     pvz. http://vartotojas:slaptazodis@proxy.tiekejas.lt:8080
 *     (tinka Webshare, IPRoyal, Bright Data ir pan.)
 *
 *  2. STEAM_PROXY_URL   — priesagos tipo proxy, kai adresas sudedamas i kelia,
 *     pvz. https://mano-worker.workers.dev -> .../steamcommunity.com/...
 *     (tinka savos Cloudflare Worker ar panasiam sprendimui)
 *
 * Nenurodzius nei vieno, uzklausos eina tiesiogiai.
 */
const HTTP_PROXY = process.env.STEAM_PROXY_HTTP?.trim();
const PREFIX_PROXY = process.env.STEAM_PROXY_URL?.trim().replace(/\/$/, "");

let agent: ProxyAgent | null = null;
function proxyAgent(): ProxyAgent | null {
  if (!HTTP_PROXY) return null;
  if (!agent) agent = new ProxyAgent(HTTP_PROXY);
  return agent;
}

export const proxyMode: "http" | "prefix" | "none" = HTTP_PROXY
  ? "http"
  : PREFIX_PROXY
    ? "prefix"
    : "none";

/** Pritaiko priesagos tipo proxy, jei jis sukonfiguruotas */
export function proxyUrl(url: string): string {
  return PREFIX_PROXY ? `${PREFIX_PROXY}/${url.replace(/^https?:\/\//, "")}` : url;
}

type FetchOpts = {
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** Sekundes, kiek Next gali kesuoti atsakyma (netaikoma su HTTP proxy) */
  revalidate?: number;
};

/**
 * Vieninga Steam uzklausa: pritaiko proxy, laiko limita ir antrastes.
 * Su HTTP proxy naudojamas undici dispatcher, todel Next kesavimas
 * negalioja — tokiu atveju kesuoja pats marsrutas per `revalidate`.
 */
export async function steamFetch(url: string, opts: FetchOpts = {}): Promise<Response> {
  const { headers, timeoutMs = 25_000, revalidate } = opts;
  const signal = AbortSignal.timeout(timeoutMs);
  const dispatcher = proxyAgent();

  if (dispatcher) {
    return fetch(proxyUrl(url), {
      headers,
      signal,
      // @ts-expect-error dispatcher yra undici plėtinys, kurio nėra DOM tipuose
      dispatcher,
      cache: "no-store",
    });
  }

  return fetch(proxyUrl(url), {
    headers,
    signal,
    ...(revalidate != null ? { next: { revalidate } } : {}),
  });
}
