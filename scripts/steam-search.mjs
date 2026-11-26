/**
 * Steam Community Market paieska per nauja API (nuo 2026-11-25 senas
 * `/market/search/render` grazina 404 — Steam perrase turgaus svetaine).
 *
 * Naujas adresas: GET /market/actions?q=Search&qp=[{...}] su antraste
 * `x-valve-request-type: queryAction`. Ypatybes:
 *   - iki 100 prekiu per uzklausa (anksciau 10);
 *   - kainos visada USD (eCurrency 1), todel konvertuojam i EUR;
 *   - `strMinSellSubtotal` — pardavejo gaunama suma, pirkejo kaina =
 *     subtotal + unSteamFee + unPublisherFee (centais);
 *   - rezultatai sugrupuoti: vienas irasas vienam skinui (viena jo
 *     nusidevejimo versija), todel ~14k irasu vietoj ~35k.
 *
 * Grazinama senojo formato struktura, kad kitas kodas nesikeistu:
 *   { total_count, results: [{ hash_name, name, sell_price, sell_listings, asset_description }] }
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36";
export const PAGE_SIZE = 100;

/** Rikiavimas: populiarumas (numatytas) arba pavadinimas A→Z (stabili tvarka). */
export const SORT = {
  popular: { sort: 0, direction: 0 },
  nameAsc: { sort: 1, direction: 1 },
};

let usdToEur = null;

/** USD→EUR kursas (ECB per frankfurter.app, atsarginis — open.er-api.com). */
export async function getUsdToEur() {
  if (usdToEur) return usdToEur;
  const sources = [
    ["https://api.frankfurter.app/latest?from=USD&to=EUR", (j) => j?.rates?.EUR],
    ["https://open.er-api.com/v6/latest/USD", (j) => j?.rates?.EUR],
  ];
  for (const [url, pick] of sources) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      const rate = Number(pick(await res.json()));
      if (rate > 0.5 && rate < 1.5) {
        usdToEur = rate;
        console.log(`USD→EUR kursas: ${rate}`);
        return rate;
      }
    } catch {}
  }
  throw new Error("Nepavyko gauti USD→EUR kurso");
}

/** "$1,971.39" -> 197139 */
const toCents = (s) => {
  const n = Number(String(s ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

function normalise(r, rate) {
  const subtotal = toCents(r.strMinSellSubtotal);
  const usd = subtotal > 0 ? subtotal + (r.unSteamFee || 0) + (r.unPublisherFee || 0) : 0;
  const d = r.asset_description ?? {};
  return {
    hash_name: r.strHash ?? d.market_hash_name,
    name: d.market_name ?? d.name ?? r.strHash,
    sell_price: usd > 0 ? Math.max(1, Math.round(usd * rate)) : 0, // EUR centai
    sell_listings: r.cSellOrders ?? 0,
    asset_description: d,
  };
}

/** Vienas paieskos puslapis. Klaidos atveju meta Error("HTTP ..."). */
export async function searchPage({ start, count = PAGE_SIZE, order = SORT.popular }) {
  const rate = await getUsdToEur();
  const qp = JSON.stringify([{ appid: 730, start, count, ...order }]);
  const url = `https://steamcommunity.com/market/actions?q=Search&qp=${encodeURIComponent(qp)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json", "x-valve-request-type": "queryAction" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const data = json?.data;
  if (!data || !Array.isArray(data.results)) throw new Error("netikėtas atsakymas");
  return { total_count: data.total_count ?? 0, results: data.results.map((r) => normalise(r, rate)) };
}
