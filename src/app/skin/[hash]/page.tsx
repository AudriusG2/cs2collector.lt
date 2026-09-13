import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PriceChart } from "@/components/PriceChart";
import { Stat } from "@/components/Stat";
import { formatEur, formatNum, timeAgo } from "@/lib/format";
import { CATEGORY_LABELS, baseName, wearLabel } from "@/lib/items";
import { loadBuff, loadHistory, loadPrices } from "@/lib/prices";

export const revalidate = 3600;
export const dynamicParams = true;

type Params = Promise<{ hash: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { hash } = await params;
  const db = await loadPrices();
  const item = findItem(db, hash)?.item;
  if (!item) return { title: "Prekė nerasta" };
  return {
    title: `${item.n} — kaina ${formatEur(item.eur)}`,
    description: `${item.n} kaina Steam Market: ${formatEur(item.eur)}. Kainos istorija, retumas ir parduodamų kiekis.`,
  };
}

export async function generateStaticParams() {
  const db = await loadPrices();
  // Kodavimas butinas: pavadinimuose yra "|", kuris negalimas failu varduose.
  // Del to kelias gali ateiti uzkoduotas dukart — tuo pasirupina findItem().
  return db.items.slice(0, 150).map((i) => ({ hash: encodeURIComponent(i.h) }));
}

/**
 * Kelio segmentas gali ateiti neuzkoduotas, uzkoduotas arba (priklausomai nuo
 * aplinkos) uzkoduotas dukart, todel dekoduojam kol pavyksta ir tikrinam kiekviena
 * tarpini variantą.
 */
function candidates(raw: string): string[] {
  const out = [raw];
  let cur = raw;
  for (let i = 0; i < 2; i += 1) {
    try {
      const next = decodeURIComponent(cur);
      if (next === cur) break;
      out.push(next);
      cur = next;
    } catch {
      break;
    }
  }
  return out;
}

function findItem(db: Awaited<ReturnType<typeof loadPrices>>, raw: string) {
  for (const c of candidates(raw)) {
    const hit = db.byHash.get(c);
    if (hit) return { item: hit, hash: c };
  }
  return null;
}

export default async function SkinPage({ params }: { params: Params }) {
  const { hash: rawHash } = await params;
  const db = await loadPrices();
  const found = findItem(db, rawHash);
  if (!found) notFound();
  const { item, hash } = found;

  const [history, buff] = await Promise.all([loadHistory(hash), loadBuff()]);
  const buffPrice = buff.byHash.get(hash) ?? null;
  const similar = db.items
    .filter((i) => i.h !== item.h && baseName(i.n) === baseName(item.n))
    .sort((a, b) => b.p - a.p)
    .slice(0, 8);

  const marketUrl = `https://steamcommunity.com/market/listings/730/${encodeURIComponent(item.h)}`;
  const first = history[0]?.eur;
  const change = first && first > 0 ? ((item.eur - first) / first) * 100 : null;
  const heroBg = `radial-gradient(circle at 50% 45%, ${item.rarity.color}22, var(--color-ink-900) 70%)`;

  return (
    <div className="flex flex-col gap-8">
      <nav className="flex items-center gap-2 text-sm text-ink-400">
        <Link href="/kainos" className="transition-colors hover:text-brand-400">
          Kainos
        </Link>
        <span>/</span>
        <span className="truncate text-ink-300">{item.n}</span>
      </nav>

      <div className="grid gap-6 md:grid-cols-[300px_1fr]">
        <div
          className="grid aspect-square place-items-center rounded-2xl border border-ink-700 p-8"
          style={{ background: heroBg }}
        >
          {item.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.icon.replace("128fx128f", "360fx360f")}
              alt={item.n}
              className="max-h-full w-auto object-contain drop-shadow-2xl"
            />
          ) : (
            <span className="text-6xl opacity-20">CS2</span>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wide"
                style={{ background: `${item.rarity.color}22`, color: item.rarity.color }}
              >
                {item.rarity.label}
              </span>
              <span className="rounded-md bg-ink-800 px-2 py-1 text-[11px] font-semibold text-ink-300">
                {CATEGORY_LABELS[item.category]}
              </span>
              {item.statTrak && (
                <span className="rounded-md bg-[#cf6a32]/20 px-2 py-1 text-[11px] font-bold text-[#f0873f]">
                  StatTrak
                </span>
              )}
              {item.souvenir && (
                <span className="rounded-md bg-[#ffd700]/15 px-2 py-1 text-[11px] font-bold text-[#ffd700]">
                  Souvenir
                </span>
              )}
            </div>
            <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight text-white">
              {item.n}
            </h1>
            <p className="mt-1 text-sm text-ink-400">{item.t}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Steam kaina" value={formatEur(item.eur)} hint="pigiausias Steam pasiūlymas" />
            <Stat
              label="Buff kaina"
              value={buffPrice ? formatEur(buffPrice.eur) : "—"}
              accent
              hint={buffPrice ? `${formatNum(buffPrice.listings)} pasiūlymų Buff.market` : "Buff kainos nėra"}
            />
            <Stat label="Parduodama" value={formatNum(item.l)} hint="aktyvių skelbimų" />
            <Stat label="Būklė" value={wearLabel(item.wear) ?? "—"} hint={item.wear ?? "netaikoma"} />
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={marketUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="rounded-xl bg-gradient-to-b from-brand-400 to-brand-600 px-5 py-2.5 text-sm font-semibold text-ink-950 transition-all hover:brightness-110"
            >
              Atidaryti Steam Market
            </a>
            <Link
              href="/inventorius"
              className="rounded-xl border border-ink-700 px-5 py-2.5 text-sm font-medium text-ink-200 transition-colors hover:border-ink-600 hover:text-white"
            >
              Skaičiuoti inventoriaus vertę
            </Link>
          </div>

          <p className="text-xs text-ink-400">Kaina atnaujinta {timeAgo(db.updated)} · valiuta EUR</p>
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-xl font-bold text-white">Kainos istorija</h2>
          {change != null && (
            <span
              className={`text-sm font-semibold ${change >= 0 ? "text-emerald-400" : "text-red-400"}`}
            >
              {change >= 0 ? "+" : ""}
              {change.toFixed(1)}%
            </span>
          )}
        </div>
        <PriceChart data={history} />
      </section>

      {similar.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold text-white">Kitos šio skino būklės</h2>
          <div className="overflow-hidden rounded-xl border border-ink-700">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-ink-700/70">
                {similar.map((s) => (
                  <tr key={s.h} className="bg-ink-850/60 transition-colors hover:bg-ink-800">
                    <td className="px-4 py-3">
                      <Link
                        href={`/skin/${encodeURIComponent(s.h)}`}
                        className="font-medium text-ink-200 hover:text-brand-400"
                      >
                        {s.n}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right text-ink-400">{formatNum(s.l)} skelb.</td>
                    <td className="px-4 py-3 text-right font-bold text-brand-400">
                      {formatEur(s.eur)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
