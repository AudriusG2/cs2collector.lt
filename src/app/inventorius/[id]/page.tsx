import type { Metadata } from "next";
import { InventoryBreakdown } from "@/components/InventoryBreakdown";
import { Stat } from "@/components/Stat";
import { StorageUnits } from "@/components/StorageUnits";
import { SteamForm } from "@/components/SteamForm";
import { formatEur, formatNum, timeAgo } from "@/lib/format";
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
        <Stat label="Steam vertė" value={formatEur(total)} hint="Steam Market kainomis" />
        <Stat
          label="Buff vertė"
          value={formatEur(result.buffTotalEur)}
          accent
          hint={result.buffUpdated ? "Buff.market kainomis" : "Buff kainos dar renkamos"}
        />
        <Stat
          label="Daiktų"
          value={formatNum(result.itemCount)}
          hint={
            result.storedItemCount > 0
              ? `+ ${formatNum(result.storedItemCount)} saugyklose`
              : "iš viso inventoriuje"
          }
        />
        <Stat label="Įkainota" value={formatNum(result.pricedCount)} hint="rasta mūsų bazėje" />
      </div>

      <StorageUnits units={result.storageUnits} storedCount={result.storedItemCount} />

      <InventoryBreakdown items={result.items} totalEur={total} />

      <section className="rounded-xl border border-ink-700 bg-ink-850/50 p-5">
        <h3 className="text-sm font-semibold text-white">Tikrinti kitą profilį</h3>
        <div className="mt-3">
          <SteamForm size="sm" />
        </div>
      </section>
    </div>
  );
}
