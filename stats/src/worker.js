/**
 * cs2collector.lt — lankytojų skaitiklis (Cloudflare Worker + D1)
 *
 *   POST /hit   — užskaito apsilankymą ir grąžina statistiką
 *   GET  /stats — tik statistika
 *
 * Atsakymas: { today, todayViews, record: { day, count }, total }
 *
 * Privatumas: IP adresas nesaugomas. Lankytojas atpažįstamas pagal
 * SHA-256(diena + IP + naršyklė + druska) — kitą dieną tas pats žmogus gauna kitą ID,
 * o ID ištrinami po 2 dienų. Slapukų nenaudojama.
 */

const ORIGINS = new Set([
  "https://cs2collector.lt",
  "https://www.cs2collector.lt",
  "http://localhost:3000",
]);
const BOT_UA = /bot|crawl|spider|slurp|headless|preview|monitor|curl|wget|python|node-fetch/i;

const dayFmt = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vilnius" });
const today = () => dayFmt.format(new Date()); // YYYY-MM-DD

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": ORIGINS.has(origin) ? origin : "https://cs2collector.lt",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

async function visitorId(day, request, salt) {
  const ip = request.headers.get("cf-connecting-ip") ?? "";
  const ua = request.headers.get("user-agent") ?? "";
  const data = new TextEncoder().encode(`${day}|${ip}|${ua}|${salt}`);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return btoa(String.fromCharCode(...hash.slice(0, 12)));
}

async function stats(db, day) {
  const [t, rec, tot] = await db.batch([
    db.prepare("SELECT uniques, views FROM days WHERE day = ?").bind(day),
    db.prepare("SELECT day, uniques FROM days ORDER BY uniques DESC, day ASC LIMIT 1"),
    db.prepare("SELECT COALESCE(SUM(uniques), 0) AS total FROM days"),
  ]);
  const r = rec.results[0];
  return {
    today: t.results[0]?.uniques ?? 0,
    todayViews: t.results[0]?.views ?? 0,
    record: r ? { day: r.day, count: r.uniques } : null,
    total: tot.results[0]?.total ?? 0,
  };
}

async function hit(db, request, env, day) {
  const ua = request.headers.get("user-agent") ?? "";
  if (!ua || BOT_UA.test(ua)) return; // robotų neskaičiuojam
  const id = await visitorId(day, request, env.SALT ?? "cs2collector");
  const ins = await db.prepare("INSERT OR IGNORE INTO visitors (day, id) VALUES (?, ?)").bind(day, id).run();
  const isNew = ins.meta.changes > 0 ? 1 : 0;
  await db.batch([
    db
      .prepare(
        "INSERT INTO days (day, uniques, views) VALUES (?, ?, 1) " +
          "ON CONFLICT(day) DO UPDATE SET uniques = uniques + excluded.uniques, views = views + 1",
      )
      .bind(day, isNew),
    // Seni ID nebereikalingi — triname (privatumas)
    db.prepare("DELETE FROM visitors WHERE day < ?").bind(dayFmt.format(new Date(Date.now() - 2 * 86_400_000))),
  ]);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("origin") ?? "";
    const headers = { ...cors(origin), "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

    const { pathname } = new URL(request.url);
    try {
      const day = today();
      if (pathname === "/hit" && request.method === "POST") {
        // Skaičiuojam tik užklausas iš svetainės (ne bet kieno)
        if (ORIGINS.has(origin)) await hit(env.DB, request, env, day);
        return new Response(JSON.stringify(await stats(env.DB, day)), { headers });
      }
      if (pathname === "/stats" && request.method === "GET") {
        return new Response(JSON.stringify(await stats(env.DB, day)), { headers });
      }
      return new Response(JSON.stringify({ error: "Nerasta" }), { status: 404, headers });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Klaida" }), { status: 500, headers });
    }
  },
};
