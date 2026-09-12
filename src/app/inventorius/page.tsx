import type { Metadata } from "next";
import { SteamForm } from "@/components/SteamForm";

export const metadata: Metadata = {
  title: "CS2 inventoriaus vertė",
  description:
    "Apskaičiuok savo CS2 inventoriaus vertę eurais pagal realias Steam Market kainas. Nemokama, be registracijos.",
};

const FAQ = [
  {
    q: "Kodėl rodo, kad inventorius privatus?",
    a: "Steam → Nustatymai → Privatumas → Inventoriaus turinys: nustatyk Viešas. Po kelių minučių pabandyk dar kartą.",
  },
  {
    q: "Iš kur imamos kainos?",
    a: "Iš Steam Community Market — imame pigiausią aktyvų pasiūlymą eurais. Duomenys atnaujinami kasdien.",
  },
  {
    q: "Ar vertė tiksli?",
    a: "Tai orientacinė Steam Market vertė. Realiai parduodant Steam nuskaičiuoja apie 15% mokesčių, o trečiųjų šalių svetainėse kainos skiriasi.",
  },
  {
    q: "Kodėl neįskaičiuoti Storage Unit daiktai?",
    a: "Steam viešai neatiduoda saugyklų — nei jų turinio, nei pačių konteinerių. Tai matyti tik prisijungus prie tavo paskyros, tad nei ši, nei bet kuri kita svetainė to parodyti negali. Norėdamas įtraukti, žaidime išimk daiktus į inventorių.",
  },
  {
    q: "Ar saugote mano duomenis?",
    a: "Ne. Prisijungti nereikia, o inventoriaus užklausa atliekama tiesiogiai per viešą Steam API.",
  },
];

export default function InventoriusPage() {
  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col items-center gap-6 pt-4 text-center">
        <h1 className="max-w-2xl text-balance text-4xl font-black tracking-tight text-white">
          CS2 inventoriaus vertės skaičiuoklė
        </h1>
        <p className="max-w-xl text-balance leading-relaxed text-ink-300">
          Įklijuok Steam profilio nuorodą arba SteamID64 — parodysime kiekvieno skino kainą ir bendrą
          sumą eurais.
        </p>
        <div className="w-full max-w-2xl">
          <SteamForm />
        </div>
        <p className="text-xs text-ink-400">
          Pavyzdžiai: <code className="text-ink-300">steamcommunity.com/id/vardas</code> arba{" "}
          <code className="text-ink-300">76561198000000000</code>
        </p>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-bold tracking-tight text-white">Dažni klausimai</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {FAQ.map((f) => (
            <div key={f.q} className="rounded-xl border border-ink-700 bg-ink-850/60 p-5">
              <h3 className="font-semibold text-white">{f.q}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{f.a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
