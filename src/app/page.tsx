import Link from "next/link";
import { ItemCard } from "@/components/ItemCard";
import { SteamForm } from "@/components/SteamForm";
import { formatNum, timeAgo } from "@/lib/format";
import { loadPrices } from "@/lib/prices";

export const revalidate = 3600;

const STEPS = [
  { n: "1", t: "Įklijuok profilį", d: "Steam profilio nuoroda, vanity vardas arba SteamID64." },
  { n: "2", t: "Palauk sekundę", d: "Nuskaitom CS2 inventorių ir sulyginam su Market kainomis." },
  { n: "3", t: "Gauk vertę eurais", d: "Bendra suma, brangiausi daiktai ir pasidalinama nuoroda." },
];

export default async function Home() {
  const db = await loadPrices();
  const popular = db.items.slice(0, 12);
  const expensive = [...db.items].sort((a, b) => b.p - a.p).slice(0, 6);

  return (
    <div className="flex flex-col gap-20">
      <section className="rise flex flex-col items-center gap-7 pt-6 text-center">
        <span className="rounded-full border border-brand-600/30 bg-brand-600/10 px-3.5 py-1.5 text-xs font-semibold text-brand-400">
          Kainos atnaujintos {timeAgo(db.updated)}
        </span>
        <h1 className="max-w-3xl text-balance text-4xl font-black leading-[1.1] tracking-tight text-white sm:text-6xl">
          Kiek vertas tavo <span className="text-brand-500">CS2 inventorius</span>?
        </h1>
        <p className="max-w-xl text-balance text-[17px] leading-relaxed text-ink-300">
          Įklijuok Steam profilį ir per kelias sekundes pamatysi visų skinų vertę eurais pagal
          realias Steam Market kainas.
        </p>
        <div className="w-full max-w-2xl">
          <SteamForm />
        </div>
        <p className="text-xs text-ink-400">
          Nemokama · nereikia prisijungti · inventorius turi būti viešas
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((s) => (
          <div key={s.n} className="rounded-xl border border-ink-700 bg-ink-850/60 p-5">
            <span className="grid size-8 place-items-center rounded-lg bg-brand-600/15 text-sm font-bold text-brand-400">
              {s.n}
            </span>
            <h3 className="mt-3 font-semibold text-white">{s.t}</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-400">{s.d}</p>
          </div>
        ))}
      </section>

      <section>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Populiariausios prekės</h2>
            <p className="mt-1 text-sm text-ink-400">
              Daugiausiai parduodama Steam Market šiuo metu
            </p>
          </div>
          <Link
            href="/kainos"
            className="shrink-0 rounded-lg border border-ink-700 px-4 py-2 text-sm font-medium text-ink-200 transition-colors hover:border-ink-600 hover:text-white"
          >
            Visos kainos →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {popular.map((i) => (
            <ItemCard key={i.h} item={i} />
          ))}
        </div>
      </section>

      {expensive.length > 0 && (
        <section>
          <h2 className="mb-5 text-2xl font-bold tracking-tight text-white">Brangiausi kataloge</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {expensive.map((i) => (
              <ItemCard key={i.h} item={i} />
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-ink-700 bg-gradient-to-br from-ink-850 to-ink-900 p-8 text-center">
        <h2 className="text-2xl font-bold text-white">
          Sekame {formatNum(db.total)} CS2 prekių kainas
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-ink-300">
          Kainos imamos tiesiai iš Steam Community Market ir atnaujinamos kasdien. Kiekvienai prekei
          kaupiame istoriją, kad matytum kryptį — ne tik šios dienos skaičių.
        </p>
        <Link
          href="/kainos"
          className="mt-6 inline-block rounded-xl bg-gradient-to-b from-brand-400 to-brand-600 px-6 py-3 font-semibold text-ink-950 transition-all hover:brightness-110"
        >
          Naršyti katalogą
        </Link>
      </section>
    </div>
  );
}
