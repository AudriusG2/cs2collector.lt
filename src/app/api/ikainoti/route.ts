import { loadPriceLookup, pick } from "@/lib/prices";

const MAX_ITEMS = 5000;

type Line = { hash: string; count: number };

/**
 * Ikainoja daiktu sarasa (naudojama saugyklu turinio importui).
 * Priima: { items: [{ hash, count }] } — hash yra Steam market_hash_name.
 *
 * Kiekvienam daiktui grazinama Steam ir Buff kaina atskirai, o sumos —
 * ir „grynos" (tik vienas saltinis), ir su atsargine kaina (Steam → Buff,
 * Buff → Steam), kad daiktai be vieno saltinio kainos nedingtu is sumos.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { items?: unknown } | null;
  const raw = Array.isArray(body?.items) ? body.items : null;
  if (!raw) return Response.json({ error: "Tikėtasi { items: [...] }" }, { status: 400 });
  if (raw.length > MAX_ITEMS) return Response.json({ error: `Daugiausia ${MAX_ITEMS} eilučių` }, { status: 413 });

  const merged = new Map<string, number>();
  for (const it of raw as Partial<Line>[]) {
    if (typeof it?.hash !== "string" || !it.hash.trim()) continue;
    const count = Math.max(1, Math.min(100_000, Math.floor(Number(it.count) || 1)));
    merged.set(it.hash, (merged.get(it.hash) ?? 0) + count);
  }

  const prices = await loadPriceLookup();
  let totalEur = 0;
  let buffTotalEur = 0;
  let steamFirstEur = 0;
  let buffFirstEur = 0;
  let pricedCount = 0;
  let steamPricedCount = 0;
  let buffPricedCount = 0;
  let unpricedCount = 0;

  const items = [...merged].map(([hash, count]) => {
    const p = prices.item(hash);
    const q = prices.quote(hash);
    const lineEur = q.steam != null ? q.steam * count : null;
    const buffLineEur = q.buff != null ? q.buff * count : null;
    const sf = pick(q, "steam").eur;
    const bf = pick(q, "buff").eur;
    if (lineEur != null) {
      totalEur += lineEur;
      steamPricedCount += count;
    }
    if (buffLineEur != null) {
      buffTotalEur += buffLineEur;
      buffPricedCount += count;
    }
    if (sf != null) {
      steamFirstEur += sf * count;
      pricedCount += count;
    } else unpricedCount += count;
    if (bf != null) buffFirstEur += bf * count;
    return {
      hash,
      name: p?.n ?? hash,
      icon: p?.icon ?? null,
      color: p?.rarity.color ?? null,
      count,
      unitEur: q.steam,
      totalEur: lineEur,
      buffUnitEur: q.buff,
      buffTotalEur: buffLineEur,
    };
  });

  const best = (i: (typeof items)[number]) => Math.max(i.buffTotalEur ?? -1, i.totalEur ?? -1);
  items.sort((a, b) => best(b) - best(a));
  return Response.json({
    items,
    totalEur,
    buffTotalEur,
    steamFirstEur,
    buffFirstEur,
    pricedCount,
    steamPricedCount,
    buffPricedCount,
    unpricedCount,
    updated: prices.updated,
    buffUpdated: prices.buffUpdated,
  });
}
