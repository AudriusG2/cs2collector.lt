/**
 * cs2collector.lt — Steam uzklausu proxy (Cloudflare Worker)
 *
 * Steam blokuoja debesu tiekeju IP adresus, todel Vercel is ju uzklausu atlikti
 * negali. Sis Worker perduoda uzklausas is Cloudflare tinklo.
 *
 * Adreso pavidalas:
 *   https://<worker>/<PROXY_SECRET>/steamcommunity.com/profiles/<id>/inventory/json/730/2
 *
 * Apsaugos:
 *   - be teisingo PROXY_SECRET grazinama 404 (kad nepavirstu atviru proxy);
 *   - leidziami tik Steam domenai;
 *   - leidziamas GET; POST — tik Steam OpenID patikrai (/openid/login).
 */

const ALLOWED_HOSTS = new Set([
  "steamcommunity.com",
  "api.steampowered.com",
  "store.steampowered.com",
]);

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
]);

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const deny = (status, message) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export default {
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "POST") return deny(405, "Neleidziamas metodas");

    const secret = env.PROXY_SECRET;
    if (!secret) return deny(500, "PROXY_SECRET nenustatytas");

    const url = new URL(request.url);
    // /<secret>/<host>/<kelias...>
    const parts = url.pathname.replace(/^\/+/, "").split("/");
    const given = parts.shift();

    // Palyginimas pastoviu laiku, kad nebutu galima atspeti simbolis po simbolio
    if (!given || given.length !== secret.length) return deny(404, "Not found");
    let diff = 0;
    for (let i = 0; i < secret.length; i += 1) diff |= given.charCodeAt(i) ^ secret.charCodeAt(i);
    if (diff !== 0) return deny(404, "Not found");

    const host = parts.shift();
    if (!host || !ALLOWED_HOSTS.has(host.toLowerCase())) return deny(403, "Neleidziamas adresas");

    const target = new URL(`https://${host}/${parts.join("/")}`);
    target.search = url.search;

    // POST leidziamas vieninteliam tikslui — OpenID parasu patikrai
    const isPost = request.method === "POST";
    if (isPost && !(host === "steamcommunity.com" && target.pathname === "/openid/login")) {
      return deny(405, "POST leidziamas tik /openid/login");
    }

    const headers = new Headers({
      "User-Agent": request.headers.get("user-agent") || DEFAULT_UA,
      Accept: request.headers.get("accept") || "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate",
      Referer: `https://${host}/`,
      Origin: `https://${host}`,
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      "X-Requested-With": "XMLHttpRequest",
    });

    let upstream;
    try {
      if (isPost) headers.set("Content-Type", "application/x-www-form-urlencoded");
      upstream = await fetch(target.toString(), {
        method: request.method,
        body: isPost ? await request.text() : undefined,
        headers,
        redirect: "follow",
        cf: { cacheTtl: 0, cacheEverything: false },
      });
    } catch (err) {
      return deny(502, `Nepavyko pasiekti Steam: ${err.message}`);
    }

    const out = new Headers();
    for (const [k, v] of upstream.headers) {
      if (!HOP_BY_HOP.has(k.toLowerCase())) out.set(k, v);
    }
    out.set("cache-control", "no-store");

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: out,
    });
  },
};
