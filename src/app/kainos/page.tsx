import type { Metadata } from "next";
import Link from "next/link";
import { ItemCard } from "@/components/ItemCard";
import { formatNum, timeAgo } from "@/lib/format";
import { ALL_RARITIES, CATEGORY_LABELS } from "@/lib/items";
import { loadPrices, searchItems } from "@/lib/prices";
import { pageSeo } from "@/lib/seo";

export const revalidate = 3600;

const TITLE = "CS2 skinų kainos";
const DESCRIPTION =
  "CS2 skinų, dėžių ir lipdukų kainos eurais. Ieškok pagal pavadinimą, filtruok pagal tipą ir retumą, rikiuok pagal kainą.";
const PER_PAGE = 48;

type SP = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : (v ?? ""));

const SORTS = [
  { v: "popular", l: "Populiariausi" },
  { v: "price-desc", l: "Brangiausi" },
  { v: "price-asc", l: "Pigiausi" },
  { v: "name", l: "Pagal pavadinimą" },
] as const;

/** Adreso parametrai — skaitomi vienoje vietoje, kad antraste (metadata) ir sarasas visada sutaptu. */
function parseQuery(sp: Awaited<SP>) {
  const rawSort = one(sp.rusiuoti);
  const sort = SORTS.find((s) => s.v === rawSort)?.v ?? "popular";
  const q = one(sp.q).trim();
  const category = one(sp.kategorija);
  const rarity = one(sp.retumas);
  return {
    q,
    category,
    rarity,
    sort,
    page: Math.max(1, Math.trunc(Number(one(sp.p)) || 1)),
    filtered: Boolean(q || category || rarity || sort !== "popular"),
  };
}

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const { filtered, page: wanted } = parseQuery(await searchParams);
  // Paieskos, filtru ir rikiavimo deriniu begale — i paieskos sistemu indeksa jie neina.
  // Indeksuojami tik gryni katalogo puslapiai (/kainos, ?p=2, ?p=3 …), kiekvienas su savo adresu.
  if (filtered) return { title: TITLE, description: DESCRIPTION, robots: { index: false, follow: true } };

  const db = await loadPrices();
  const page = Math.min(wanted, Math.max(1, Math.ceil(db.items.length / PER_PAGE)));
  const title = page > 1 ? `${TITLE} — ${page} psl.` : TITLE;
  return {
    title,
    description: DESCRIPTION,
    ...pageSeo({ path: page > 1 ? `/kainos?p=${page}` : "/kainos", title, description: DESCRIPTION }),
  };
}

export default async function KainosPage({ searchParams }: { searchParams: SP }) {
  const { q, category, rarity, sort, page } = parseQuery(await searchParams);

  const db = await loadPrices();
  const res = searchItems(db, { q, category, rarity, sort, page, perPage: PER_PAGE });

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

      <h2 className="sr-only">Paieška ir filtrai</h2>
      <form method="get" action="/kainos" className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            name="q"
            defaultValue={q}
            placeholder="Ieškok: AK-47, Karambit, Dreams & Nightmares…"
            aria-label="Ieškoti prekių pagal pavadinimą"
            className="min-w-0 flex-1 rounded-xl border border-ink-700 bg-ink-850 px-4 py-3 text-sm text-ink-200 outline-none transition-colors placeholder:text-ink-400 focus:border-brand-600"
          />
          <select
            name="rusiuoti"
            defaultValue={sort}
            aria-label="Rikiavimas"
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

      <h2 className="sr-only">Prekių sąrašas</h2>
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
        <nav aria-label="Puslapiai" className="flex items-center justify-center gap-2 pt-4">
          {/* Paprastos nuorodos, ne <Link>: narsykleje Next antraste (pavadinima, canonical) kesuoja
              be adreso parametru, todel perejus per <Link> puslapis N liktu su 1 puslapio pavadinimu.
              Filtru nuorodos lieka <Link> (greiciau): ju pavadinimas toks pat, o paieskos sistemos
              kiekviena adresa krauna is naujo ir gauna teisinga antraste is serverio. */}
          {res.page > 1 && (
            <a
              href={qs({ p: res.page - 1 })}
              className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-ink-200 transition-colors hover:border-ink-600 hover:text-white"
            >
              ← Atgal
            </a>
          )}
          <span className="px-3 text-sm text-ink-400">
            {res.page} / {res.totalPages}
          </span>
          {res.page < res.totalPages && (
            <a
              href={qs({ p: res.page + 1 })}
              className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-ink-200 transition-colors hover:border-ink-600 hover:text-white"
            >
              Pirmyn →
            </a>
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
