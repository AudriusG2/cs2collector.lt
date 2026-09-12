import type { Metadata } from "next";
import Link from "next/link";
import { Stat } from "@/components/Stat";
import { SteamForm } from "@/components/SteamForm";
import { formatEur, formatNum, timeAgo } from "@/lib/format";
import { CATEGORY_LABELS, wearShort } from "@/lib/items";
import { SteamError, getInventoryValue, resolveSteamId } from "@/lib/steam";
import type { InventoryResult } from "@/lib/types";

export const revalidate = 900;

type Params = Promise<{ id: string }>;

export const metadata: Metadata = {
  title: "Inventoriaus vertė",
  robots: { index: false, follow: true },
};

export default async function InventoryResultPage({ params }: { params: Params }) {
  const { id } = await params;
  const input = decodeURIComponent(id);

  let result: InventoryResult | null = null;
  let error: { message: string; code: string } | null = null;

  try {
    const steamId = await resolveSteamId(input);
    result = await getInventoryValue(steamId);
  } catch (e) {
    error =
      e instanceof SteamError
        ? { message: e.message, code: e.code }
        : { message: "Nepavyko gauti inventoriaus. Pabandyk dar kartą po minutės.", code: "network" };
  }

  if (error || !result) {
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <div className="rounded-2xl border border-red-500/25 bg-red-500/5 p-8">
          <h1 className="text-xl font-bold text-white">Nepavyko</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-300">{error?.message}</p>
          {error?.code === "private" && (
            <p className="mt-3 rounded-lg bg-ink-850 p-3 text-xs leading-relaxed text-ink-400">
              Steam → Nustatymai → Privatumas → Inventoriaus turinys → <b>Viešas</b>
            </p>
          )}
        </div>
        <div className="mt-6">
          <SteamForm size="sm" initial={input} />
        </div>
      </div>
    );
  }

  const top = result.items.slice(0, 60);
  const byCategory = new Map<string, number>();
  for (const it of result.items) {
    byCategory.set(it.category, (byCategory.get(it.category) ?? 0) + (it.totalEur ?? 0));
  }
  const categories = [...byCategory.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const total = result.totalEur;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-4">
        {result.profile?.avatar && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={result.profile.avatar} alt="" className="size-14 rounded-xl border border-ink-700" />
        )}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-black tracking-tight text-white">
            {result.profile?.name ?? "CS2 inventorius"}
          </h1>
          <p className="text-xs text-ink-400">
            SteamID {result.steamId} · kainos atnaujintos {timeAgo(result.updated)}
          </p>
        </div>
        <a
          href={`https://steamcommunity.com/profiles/${result.steamId}/inventory/#730`}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="ml-auto rounded-lg border border-ink-700 px-4 py-2 text-sm text-ink-200 transition-colors hover:border-ink-600 hover:text-white"
        >
          Steam profilis
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Bendra vertė" value={formatEur(total)} accent hint="Steam Market kainomis" />
        <Stat label="Daiktų" value={formatNum(result.itemCount)} hint="iš viso inventoriuje" />
        <Stat label="Įkainota" value={formatNum(result.pricedCount)} hint="rasta mūsų bazėje" />
        <Stat
          label="Vidutinė kaina"
          value={formatEur(result.pricedCount ? total / result.pricedCount : 0)}
          hint="už įkainotą daiktą"
        />
      </div>

      {categories.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-white">Vertė pagal kategoriją</h2>
          <div className="flex flex-col gap-2">
            {categories.map(([cat, val]) => {
              const pct = total > 0 ? (val / total) * 100 : 0;
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

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-bold text-white">Brangiausi daiktai</h2>
          {result.unpricedCount > 0 && (
            <span className="text-xs text-ink-400">
              {formatNum(result.unpricedCount)} daiktų be kainos duomenų
            </span>
          )}
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
              {top.map((it) => (
                <tr key={it.hash} className="bg-ink-900/40 transition-colors hover:bg-ink-800/60">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      {it.icon && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.icon} alt="" loading="lazy" className="size-9 shrink-0 object-contain" />
                      )}
                      <div className="min-w-0">
                        <Link
                          href={`/skin/${encodeURIComponent(it.hash)}`}
                          className="line-clamp-1 font-medium text-ink-200 hover:text-brand-400"
                        >
                          {it.name}
                        </Link>
                        <span className="block text-[11px]" style={{ color: it.rarity.color }}>
                          {it.rarity.label}
                          {it.wear ? ` · ${wearShort(it.wear)}` : ""}
                        </span>
                      </div>
                    </div>
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
        {result.items.length > top.length && (
          <p className="mt-2 text-xs text-ink-400">
            Rodoma {top.length} iš {formatNum(result.items.length)} skirtingų prekių.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-ink-700 bg-ink-850/50 p-5">
        <h3 className="text-sm font-semibold text-white">Tikrinti kitą profilį</h3>
        <div className="mt-3">
          <SteamForm size="sm" />
        </div>
      </section>
    </div>
  );
}
