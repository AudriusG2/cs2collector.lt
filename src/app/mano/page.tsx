import type { Metadata } from "next";
import { InventoryBreakdown } from "@/components/InventoryBreakdown";
import { ManoPanel } from "@/components/ManoPanel";
import { Stat } from "@/components/Stat";
import { formatEur, formatNum, timeAgo } from "@/lib/format";
import { getSessionSteamId } from "@/lib/session";
import { SteamError, getInventoryValue, getProfile } from "@/lib/steam";
import type { InventoryResult } from "@/lib/types";

export const metadata: Metadata = {
  title: "Mano kolekcija",
  robots: { index: false, follow: false },
};

type SP = Promise<Record<string, string | string[] | undefined>>;

const BENEFITS = [
  { t: "Inventorius atsidaro pats", d: "Nereikia kaskart įklijuoti profilio nuorodos." },
  { t: "Vertės istorija", d: "Kiekvieną apsilankymą įrašome sumą — matai, kaip keičiasi kolekcijos vertė." },
  { t: "Storage Unit turinys", d: "Įkelk saugyklų sąrašą ir gauk bendrą visos kolekcijos vertę." },
];

export default async function ManoPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const loginError = typeof sp.klaida === "string" ? sp.klaida : null;
  const steamId = await getSessionSteamId();

  if (!steamId) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-8 py-6">
        <div className="text-center">
          <h1 className="text-balance text-4xl font-black tracking-tight text-white">Mano kolekcija</h1>
          <p className="mx-auto mt-3 max-w-lg text-balance leading-relaxed text-ink-300">
            Prisijunk per Steam ir matyk visą savo CS2 kolekcijos vertę vienoje vietoje — kartu su
            Storage Unit saugyklomis.
          </p>
        </div>

        {loginError && (
          <p className="rounded-xl border border-red-500/25 bg-red-500/5 px-4 py-3 text-center text-sm text-red-300">
            {loginError}
          </p>
        )}

        <div className="flex flex-col items-center gap-3">
          {/* Paprasta nuoroda, ne <Link>: marsrutas nukreipia i steamcommunity.com */}
          <a
            href="/api/auth/steam"
            className="inline-flex items-center gap-2.5 rounded-xl bg-[#171a21] px-6 py-3.5 font-semibold text-white ring-1 ring-ink-600 transition-colors hover:bg-[#1f2530]"
          >
            <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden>
              <path d="M12 2a10 10 0 0 0-9.96 9.1l5.36 2.22a2.83 2.83 0 0 1 1.6-.5l2.39-3.46v-.05a3.78 3.78 0 1 1 3.78 3.78h-.09l-3.4 2.43a2.84 2.84 0 0 1-5.62.56L2.3 14.52A10 10 0 1 0 12 2Zm-4.72 15.18-1.23-.5a2.13 2.13 0 1 0 1.16-2.9l1.27.52a1.57 1.57 0 1 1-1.2 2.9Zm9.5-7.7a2.52 2.52 0 1 0-2.52 2.52 2.52 2.52 0 0 0 2.52-2.52Zm-4.4 0a1.89 1.89 0 1 1 1.88 1.89 1.89 1.89 0 0 1-1.88-1.89Z" />
            </svg>
            Prisijungti per Steam
          </a>
          <p className="max-w-md text-center text-xs leading-relaxed text-ink-400">
            Prisijungimas vyksta oficialiame <b className="text-ink-300">steamcommunity.com</b> puslapyje.
            Tavo slaptažodžio mes nematome ir negauname — Steam mums patvirtina tik tavo SteamID.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {BENEFITS.map((b) => (
            <div key={b.t} className="rounded-xl border border-ink-700 bg-ink-850/60 p-4">
              <h2 className="font-semibold text-white">{b.t}</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-400">{b.d}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  let result: InventoryResult | null = null;
  let error: string | null = null;
  try {
    result = await getInventoryValue(steamId);
  } catch (e) {
    error = e instanceof SteamError ? e.message : "Nepavyko gauti inventoriaus. Pabandyk po minutės.";
  }
  const profile = result?.profile ?? (await getProfile(steamId));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-4">
        {profile?.avatar && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar} alt="" className="size-14 rounded-xl border border-ink-700" />
        )}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-black tracking-tight text-white">
            {profile?.name ?? "Mano kolekcija"}
          </h1>
          <p className="text-xs text-ink-400">
            SteamID {steamId}
            {result ? ` · kainos atnaujintos ${timeAgo(result.updated)}` : ""}
          </p>
        </div>
        <form action="/api/auth/logout" method="post" className="ml-auto">
          <button
            type="submit"
            className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-ink-300 transition-colors hover:border-ink-600 hover:text-white"
          >
            Atsijungti
          </button>
        </form>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/25 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      ) : (
        result && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Steam vertė" value={formatEur(result.totalEur)} hint="inventorius, be saugyklų" />
            <Stat
              label="Buff vertė"
              value={formatEur(result.buffTotalEur)}
              accent
              hint={result.buffUpdated ? "inventorius, be saugyklų" : "Buff kainos dar renkamos"}
            />
            <Stat label="Daiktų" value={formatNum(result.itemCount)} hint="inventoriuje" />
            <Stat label="Įkainota" value={formatNum(result.pricedCount)} hint="rasta kainų bazėje" />
          </div>
        )
      )}

      <ManoPanel
        steamId={steamId}
        inventoryEur={result?.totalEur ?? null}
        inventoryBuffEur={result?.buffUpdated ? result.buffTotalEur : null}
      />

      {result && <InventoryBreakdown items={result.items} totalEur={result.totalEur} />}
    </div>
  );
}
