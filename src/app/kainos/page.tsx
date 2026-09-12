import type { Metadata } from "next";
import Link from "next/link";
import { ItemCard } from "@/components/ItemCard";
import { formatNum, timeAgo } from "@/lib/format";
import { ALL_RARITIES, CATEGORY_LABELS } from "@/lib/items";
import { loadPrices, searchItems } from "@/lib/prices";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "CS2 skinų kainos",
  description:
    "Visos CS2 skinų, dėžių ir lipdukų kainos eurais. Ieškok pagal pavadinimą, filtruok pagal tipą, retumą ir kainą.",
};

type SP = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : (v ?? ""));

const SORTS = [
  { v: "popular", l: "Populiariausi" },
  { v: "price-desc", l: "Brangiausi" },
  { v: "price-asc", l: "Pigiausi" },
  { v: "name", l: "Pagal pavadinimą" },
] as const;

export default async function KainosPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = one(sp.q);
  const category = one(sp.kategorija);
  const rarity = one(sp.retumas);
  const sort = (one(sp.rusiuoti) || "popular") as "popular" | "price-asc" | "price-desc" | "name";
  const page = Number(one(sp.p)) || 1;

  const db = await loadPrices();
  const res = searchItems(db, { q, category, rarity, sort, page, perPage: 48 });

  const qs = (patch: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const base = { q, kategorija: category, retumas: rarity, rusiuoti: sort, p: page, ...patch };
    for (const [k, v] of Object.entries(base)) {
      if (v && !(k === "rusiuoti" && v === "popular") && !(k === "p" && v === 1)) p.set(k, String(v));
    }
    const s = p.toString();
    return s ? `/kainos?${s}` : "/kainos";
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-white">CS2 skinų kainos</h1>
        <p className="mt-1.5 text-sm text-ink-400">
          {formatNum(db.items.length)} prekių duomenų bazėje · atnaujinta {timeAgo(db.updated)}
        </p>
      </div>

      <form method="get" action="/kainos" className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            name="q"
            defaultValue={q}
            placeholder="Ieškok: AK-47, Karambit, Dreams & Nightmares…"
            className="min-w-0 flex-1 rounded-xl border border-ink-700 bg-ink-850 px-4 py-3 text-sm text-ink-200 outline-none transition-colors placeholder:text-ink-400 focus:border-brand-600"
          />
          <select
            name="rusiuoti"
            defaultValue={sort}
            className="rounded-xl border border-ink-700 bg-ink-850 px-3 py-3 text-sm text-ink-200 outline-none focus:border-brand-600"
          >
            {SORTS.map((s) => (
              <option key={s.v} value={s.v}>
                {s.l}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-xl bg-gradient-to-b from-brand-400 to-brand-600 px-6 py-3 text-sm font-semibold text-ink-950 transition-all hover:brightness-110"
          >
            Ieškoti
          </button>
        </div>
        {category && <input type="hidden" name="kategorija" value={category} />}
        {rarity && <input type="hidden" name="retumas" value={rarity} />}
      </form>

      <div className="flex flex-wrap gap-1.5">
        <Chip href={qs({ kategorija: undefined, p: 1 })} active={!category}>
          Viskas
        </Chip>
        {Object.entries(CATEGORY_LABELS).map(([k, l]) => (
          <Chip key={k} href={qs({ kategorija: k, p: 1 })} active={category === k}>
            {l}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip href={qs({ retumas: undefined, p: 1 })} active={!rarity}>
          Visi retumai
        </Chip>
        {ALL_RARITIES.map((r) => (
          <Chip key={r.key} href={qs({ retumas: r.key, p: 1 })} active={rarity === r.key} dot={r.color}>
            {r.label}
          </Chip>
        ))}
      </div>

      <p className="text-sm text-ink-400">
        Rasta <span className="font-semibold text-ink-200">{formatNum(res.count)}</span> prekių
      </p>

      {res.items.length === 0 ? (
        <div className="rounded-xl border border-ink-700 bg-ink-850/60 p-12 text-center">
          <p className="text-ink-300">Pagal šiuos filtrus nieko nerasta.</p>
          <Link href="/kainos" className="mt-3 inline-block text-sm font-medium text-brand-400 hover:underline">
            Išvalyti filtrus
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {res.items.map((i) => (
            <ItemCard key={i.h} item={i} />
          ))}
        </div>
      )}

      {res.totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2 pt-4">
          {res.page > 1 && (
            <Link
              href={qs({ p: res.page - 1 })}
              className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-ink-200 transition-colors hover:border-ink-600 hover:text-white"
            >
              ← Atgal
            </Link>
          )}
          <span className="px-3 text-sm text-ink-400">
            {res.page} / {res.totalPages}
          </span>
          {res.page < res.totalPages && (
            <Link
              href={qs({ p: res.page + 1 })}
              className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-ink-200 transition-colors hover:border-ink-600 hover:text-white"
            >
              Pirmyn →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

function Chip({
  href,
  active,
  dot,
  children,
}: {
  href: string;
  active: boolean;
  dot?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-brand-600 bg-brand-600/15 text-brand-400"
          : "border-ink-700 bg-ink-850/60 text-ink-300 hover:border-ink-600 hover:text-white"
      }`}
    >
      {dot && <span className="size-2 rounded-full" style={{ background: dot }} />}
      {children}
    </Link>
  );
}
