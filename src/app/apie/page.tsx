import type { Metadata } from "next";
import Link from "next/link";
import { formatNum, timeAgo } from "@/lib/format";
import { loadPrices } from "@/lib/prices";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Apie projektą",
  description:
    "Kas yra cs2collector.lt, iš kur imami duomenys ir kaip skaičiuojama CS2 inventoriaus vertė.",
};

export default async function ApiePage() {
  const db = await loadPrices();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-10">
      <header>
        <h1 className="text-3xl font-black tracking-tight text-white">Apie cs2collector.lt</h1>
        <p className="mt-2 leading-relaxed text-ink-300">
          Lietuviškas įrankis CS2 skinų kainoms sekti ir inventoriaus vertei įvertinti. Be
          registracijos, be reklamų tarp turinio ir be prisijungimo prie Steam.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Fact value={formatNum(db.items.length)} label="prekių bazėje" />
        <Fact value={formatNum(db.total)} label="prekių Steam kataloge" />
        <Fact value={timeAgo(db.updated)} label="paskutinis atnaujinimas" />
      </section>

      <Section title="Iš kur imami duomenys">
        <p>
          Kainos surenkamos iš viešo Steam Community Market. Kiekvienai prekei imame pigiausią
          aktyvų pasiūlymą eurais ir aktyvių skelbimų kiekį. Duomenys perrenkami kasdien, o kiekvienos
          dienos rezultatas išsaugomas — taip auga kainų istorija.
        </p>
      </Section>

      <Section title="Kaip skaičiuojama inventoriaus vertė">
        <p>
          Nuskaitome viešą CS2 inventorių per Steam API, sugrupuojame vienodus daiktus ir kiekvieną
          sulyginame su savo kainų baze pagal <code className="text-ink-200">market_hash_name</code>.
          Daiktai, kurių neturime bazėje, į sumą neįskaičiuojami ir rodomi atskirai.
        </p>
      </Section>

      <Section title="Ką reiškia skaičius">
        <p>
          Tai <b className="text-ink-200">Steam Market vertė</b>, o ne suma, kurią gautum į banko
          sąskaitą. Parduodant Steam nuskaičiuoja apie 15% mokesčių, o trečiųjų šalių svetainėse
          kainos dažnai būna 10–30% žemesnės. Naudok skaičių kaip orientyrą.
        </p>
      </Section>

      <Section title="Privatumas">
        <p>
          Nereikalaujame jokių prisijungimų ir nesaugome tavo inventoriaus. Užklausa atliekama į
          viešus Steam galinius taškus, rezultatas trumpam pakešuojamas našumui.
        </p>
      </Section>

      <Section title="Teisinė informacija">
        <p>
          Projektas nėra susijęs su Valve Corporation ir nėra jos remiamas. Counter-Strike, CS2 ir
          Steam yra Valve Corporation prekių ženklai.
        </p>
      </Section>

      <div className="rounded-xl border border-ink-700 bg-ink-850/60 p-6 text-center">
        <p className="text-sm text-ink-300">Pasiruošęs pasitikrinti?</p>
        <Link
          href="/inventorius"
          className="mt-3 inline-block rounded-xl bg-gradient-to-b from-brand-400 to-brand-600 px-6 py-3 font-semibold text-ink-950 transition-all hover:brightness-110"
        >
          Skaičiuoti inventoriaus vertę
        </Link>
      </div>
    </div>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-850/60 p-4 text-center">
      <p className="text-xl font-bold text-brand-400">{value}</p>
      <p className="mt-0.5 text-xs text-ink-400">{label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-bold text-white">{title}</h2>
      <div className="text-sm leading-relaxed text-ink-300">{children}</div>
    </section>
  );
}
