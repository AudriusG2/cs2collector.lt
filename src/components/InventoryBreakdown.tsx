import Link from "next/link";
import { formatEur, formatNum } from "@/lib/format";
import { CATEGORY_LABELS, wearShort } from "@/lib/items";
import type { InventoryItem } from "@/lib/types";

const MAX_PRICED_ROWS = 150;

/**
 * Inventoriaus detalizacija: verte pagal kategorijas, daiktai su kaina ir
 * atskirai daiktai be kainos su priezastimi. Naudojama /inventorius ir /mano.
 */
export function InventoryBreakdown({ items, totalEur }: { items: InventoryItem[]; totalEur: number }) {
  const priced = items.filter((i) => i.totalEur != null);
  const unpriced = items.filter((i) => i.totalEur == null);

  const byCategory = new Map<string, number>();
  for (const it of priced) byCategory.set(it.category, (byCategory.get(it.category) ?? 0) + (it.totalEur ?? 0));
  const categories = [...byCategory.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

  const shown = priced.slice(0, MAX_PRICED_ROWS);
  const unpricedTotal = unpriced.reduce((s, i) => s + i.count, 0);
  const notMarketable = unpriced.filter((i) => !i.marketable).reduce((s, i) => s + i.count, 0);

  return (
    <div className="flex flex-col gap-8">
      {categories.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-white">Vertė pagal kategoriją</h2>
          <div className="flex flex-col gap-2">
            {categories.map(([cat, val]) => {
              const pct = totalEur > 0 ? (val / totalEur) * 100 : 0;
              return (
                <div key={cat} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-sm text-ink-300">
                    {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat}
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400"
                      style={{ width: `${Math.max(2, pct)}%` }}
                    />
                  </div>
                  <span className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums text-ink-200">
                    {formatEur(val)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {priced.length > 0 && (
        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-lg font-bold text-white">Daiktai su kaina</h2>
            <span className="text-xs text-ink-400">
              {formatNum(priced.reduce((s, i) => s + i.count, 0))} daiktų · {formatEur(totalEur)}
            </span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-ink-700">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-ink-850">
                <tr className="text-left text-[11px] uppercase tracking-wider text-ink-400">
                  <th className="px-4 py-3 font-semibold">Prekė</th>
                  <th className="px-4 py-3 text-right font-semibold">Kiekis</th>
                  <th className="px-4 py-3 text-right font-semibold">Vnt.</th>
                  <th className="px-4 py-3 text-right font-semibold">Viso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700/70">
                {shown.map((it) => (
                  <tr key={it.hash} className="bg-ink-900/40 transition-colors hover:bg-ink-800/60">
                    <td className="px-4 py-2.5">
                      <ItemCell item={it} linkToSkin />
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink-400">{it.count}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink-300">{formatEur(it.unitEur)}</td>
                    <td className="px-4 py-2.5 text-right font-bold tabular-nums text-brand-400">
                      {formatEur(it.totalEur)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {priced.length > shown.length && (
            <p className="mt-2 text-xs text-ink-400">
              Rodoma {shown.length} brangiausių iš {formatNum(priced.length)} skirtingų prekių.
            </p>
          )}
        </section>
      )}

      {unpriced.length > 0 && (
        <section>
          <div className="mb-3">
            <h2 className="text-lg font-bold text-white">Daiktai be kainos</h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-400">
              {formatNum(unpricedTotal)} daiktų į sumą neįskaičiuota.
              {notMarketable > 0 && ` ${formatNum(notMarketable)} iš jų Steam Market neparduodami (medaliai, monetos, C4 ir pan.).`}
              {unpricedTotal - notMarketable > 0 &&
                ` ${formatNum(unpricedTotal - notMarketable)} parduodami, bet jų dar nėra mūsų kainų bazėje.`}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {unpriced.map((it) => (
              <div
                key={it.hash}
                className="flex items-center gap-3 rounded-lg border border-ink-700 bg-ink-900/40 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <ItemCell item={it} />
                </div>
                {it.count > 1 && <span className="text-xs tabular-nums text-ink-400">×{it.count}</span>}
                {it.marketable ? (
                  <a
                    href={`https://steamcommunity.com/market/listings/730/${encodeURIComponent(it.hash)}`}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="shrink-0 rounded-md border border-ink-600 px-2 py-1 text-[11px] text-ink-300 hover:border-brand-600 hover:text-brand-400"
                  >
                    Kaina Steam ↗
                  </a>
                ) : (
                  <span className="shrink-0 rounded-md bg-ink-800 px-2 py-1 text-[11px] text-ink-400">
                    Neparduodamas
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ItemCell({ item, linkToSkin = false }: { item: InventoryItem; linkToSkin?: boolean }) {
  const label = linkToSkin ? (
    <Link
      href={`/skin/${encodeURIComponent(item.hash)}`}
      className="line-clamp-1 font-medium text-ink-200 hover:text-brand-400"
    >
      {item.name}
    </Link>
  ) : (
    <span className="line-clamp-1 font-medium text-ink-200">{item.name}</span>
  );

  return (
    <div className="flex items-center gap-3">
      {item.icon && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.icon} alt="" loading="lazy" className="size-9 shrink-0 object-contain" />
      )}
      <div className="min-w-0">
        {label}
        <span className="block text-[11px]" style={{ color: item.rarity.color }}>
          {item.rarity.label}
          {item.wear ? ` · ${wearShort(item.wear)}` : ""}
        </span>
      </div>
    </div>
  );
}
