import { loadBuff, loadPrices } from "@/lib/prices";

const MAX_ITEMS = 5000;

type Line = { hash: string; count: number };

/**
 * Ikainoja daiktu sarasa (naudojama saugyklu turinio importui).
 * Priima: { items: [{ hash, count }] } — hash yra Steam market_hash_name.
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

  const [db, buff] = await Promise.all([loadPrices(), loadBuff()]);
  let totalEur = 0;
  let pricedCount = 0;
  let unpricedCount = 0;
  let buffTotalEur = 0;

  const items = [...merged].map(([hash, count]) => {
    const p = db.byHash.get(hash);
    const unitEur = p ? p.eur : null;
    const lineEur = unitEur != null ? unitEur * count : null;
    const b = buff.byHash.get(hash);
    const buffUnitEur = b ? b.eur : null;
    const buffLineEur = buffUnitEur != null ? buffUnitEur * count : null;
    if (lineEur != null) totalEur += lineEur;
    if (buffLineEur != null) buffTotalEur += buffLineEur;
    if (lineEur != null || buffLineEur != null) pricedCount += count;
    else unpricedCount += count;
    return {
      hash,
      name: p?.n ?? hash,
      icon: p?.icon ?? null,
      color: p?.rarity.color ?? null,
      count,
      unitEur,
      totalEur: lineEur,
      buffUnitEur,
      buffTotalEur: buffLineEur,
    };
  });

  items.sort((a, b) => Math.max(b.buffTotalEur ?? -1, b.totalEur ?? -1) - Math.max(a.buffTotalEur ?? -1, a.totalEur ?? -1));
  return Response.json({ items, totalEur, buffTotalEur, pricedCount, unpricedCount, updated: db.updated, buffUpdated: buff.updated });
}
