"use client";

import { useEffect, useState } from "react";
import { PriceChart } from "@/components/PriceChart";
import { formatEur, formatNum } from "@/lib/format";

type Priced = {
  hash: string;
  name: string;
  icon: string | null;
  color: string | null;
  count: number;
  unitEur: number | null;
  totalEur: number | null;
};

type StorageState = {
  importedAt: string;
  units: { name: string; count: number; totalEur: number }[];
  items: Priced[];
  totalEur: number;
  pricedCount: number;
  unpricedCount: number;
};

type HistoryPoint = { date: string; eur: number };

const histKey = (id: string) => `cs2c:hist:${id}`;
const storageKey = (id: string) => `cs2c:storage:${id}`;

/* localStorage gali buti neprieinamas (privatus langas, blokuoti slapukai) */
function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* nieko — tiesiog neissaugosim */
  }
}

type ExportFile = {
  units?: { name?: string; items?: { hash?: string; count?: number }[] }[];
  items?: { hash?: string; count?: number }[];
};

export function ManoPanel({
  steamId,
  inventoryEur,
  inventoryBuffEur = null,
}: {
  steamId: string;
  inventoryEur: number | null;
  /** Inventoriaus verte Buff kainomis; null — Buff duomenu nera */
  inventoryBuffEur?: number | null;
}) {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [storage, setStorage] = useState<StorageState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ikeliam issaugota bukle ir irasom siandienos verte i istorija
  useEffect(() => {
    const saved = readJson<StorageState>(storageKey(steamId));
    setStorage(saved);

    const hist = readJson<HistoryPoint[]>(histKey(steamId)) ?? [];
    if (inventoryEur != null) {
      const today = new Date().toISOString().slice(0, 10);
      const total = Math.round((inventoryEur + (saved?.totalEur ?? 0)) * 100) / 100;
      const next = [...hist.filter((p) => p.date !== today), { date: today, eur: total }]
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-365);
      writeJson(histKey(steamId), next);
      setHistory(next);
    } else {
      setHistory(hist);
    }
  }, [steamId, inventoryEur]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const parsed = JSON.parse(await file.text()) as ExportFile;
      const units = parsed.units?.length
        ? parsed.units
        : parsed.items
          ? [{ name: "Saugykla", items: parsed.items }]
          : null;
      if (!units) throw new Error("Failas neatpažintas — tikėtasi cs2collector eksporto.");

      const lines = units.flatMap((u) =>
        (u.items ?? []).map((it) => ({ hash: String(it.hash ?? ""), count: Number(it.count) || 1 })),
      );
      if (!lines.length) throw new Error("Faile nėra daiktų.");

      const res = await fetch("/api/ikainoti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: lines }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Nepavyko įkainoti.");
      const priced = (await res.json()) as Omit<StorageState, "importedAt" | "units">;

      const unitPrice = new Map(priced.items.map((i) => [i.hash, i.unitEur ?? 0]));
      const state: StorageState = {
        ...priced,
        importedAt: new Date().toISOString(),
        units: units.map((u, idx) => {
          const items = u.items ?? [];
          return {
            name: u.name?.trim() || `Saugykla ${idx + 1}`,
            count: items.reduce((s, it) => s + (Number(it.count) || 1), 0),
            totalEur: items.reduce((s, it) => s + (unitPrice.get(String(it.hash)) ?? 0) * (Number(it.count) || 1), 0),
          };
        }),
      };
      writeJson(storageKey(steamId), state);
      setStorage(state);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepavyko nuskaityti failo.");
    } finally {
      setBusy(false);
    }
  }

  function clearStorage() {
    try {
      localStorage.removeItem(storageKey(steamId));
    } catch {
      /* nieko */
    }
    setStorage(null);
  }

  const grand = (inventoryEur ?? 0) + (storage?.totalEur ?? 0);

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-2xl border border-brand-600/30 bg-gradient-to-br from-brand-600/10 to-transparent p-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-400">Visa kolekcija</p>
        <p className="mt-1 text-4xl font-black tabular-nums text-white">{formatEur(grand)}</p>
        <p className="mt-1 text-sm text-ink-300">
          Inventorius {formatEur(inventoryEur ?? 0)}
          {" + "}saugyklos {storage ? formatEur(storage.totalEur) : "neįkeltos"} · Steam kainomis
        </p>
        {inventoryBuffEur != null && (
          <p className="mt-0.5 text-sm text-ink-400">
            Inventorius Buff kainomis: <b className="text-brand-400">{formatEur(inventoryBuffEur)}</b>
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-white">Vertės istorija</h2>
        <PriceChart data={history} />
        <p className="mt-2 text-xs text-ink-400">
          Istorija saugoma tik šiame įrenginyje (naršyklėje) ir pildosi kaskart apsilankius.
        </p>
      </section>

      <section className="rounded-xl border border-ink-700 bg-ink-850/60 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Storage Unit saugyklos</h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-400">
              Steam saugyklų turinio viešai neatiduoda. Nuskaityk jį savo kompiuteryje su{" "}
              <a
                href="https://github.com/AudriusG2/cs2collector.lt/tree/main/tools/storage-export"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-brand-400 underline hover:text-brand-300"
              >
                cs2collector eksporto programa
              </a>{" "}
              — prisijungimas vyksta QR kodu tavo telefone, be slaptažodžio — ir įkelk gautą{" "}
              <code className="text-ink-300">.json</code> failą čia.
            </p>
          </div>
          <label
            className={`cursor-pointer rounded-xl bg-gradient-to-b from-brand-400 to-brand-600 px-5 py-2.5 text-sm font-semibold text-ink-950 transition-all hover:brightness-110 ${busy ? "pointer-events-none opacity-50" : ""}`}
          >
            {busy ? "Skaičiuoju…" : storage ? "Įkelti iš naujo" : "Įkelti failą"}
            <input type="file" accept="application/json,.json" onChange={onFile} className="sr-only" />
          </label>
        </div>

        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

        {storage && (
          <div className="mt-5 flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {storage.units.map((u) => (
                <div key={u.name} className="rounded-lg border border-ink-700 bg-ink-900/50 p-3">
                  <p className="truncate text-sm font-medium text-ink-200">📦 {u.name}</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-brand-400">{formatEur(u.totalEur)}</p>
                  <p className="text-xs text-ink-400">{formatNum(u.count)} daiktų</p>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-xl border border-ink-700">
              <table className="w-full min-w-[480px] text-sm">
                <tbody className="divide-y divide-ink-700/70">
                  {storage.items.slice(0, 50).map((it) => (
                    <tr key={it.hash} className="bg-ink-900/40">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-3">
                          {it.icon && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={it.icon} alt="" loading="lazy" className="size-8 shrink-0 object-contain" />
                          )}
                          <span className="line-clamp-1 text-ink-200" style={it.color ? { color: it.color } : undefined}>
                            {it.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-ink-400">{it.count}</td>
                      <td className="px-4 py-2 text-right font-bold tabular-nums text-brand-400">
                        {formatEur(it.totalEur)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-400">
              <span>
                Įkelta {new Date(storage.importedAt).toLocaleString("lt-LT")}
                {storage.unpricedCount > 0 && ` · ${formatNum(storage.unpricedCount)} daiktų be kainos`}
              </span>
              <button type="button" onClick={clearStorage} className="text-ink-300 underline hover:text-white">
                Pašalinti saugyklų duomenis
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
