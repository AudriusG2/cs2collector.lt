"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PriceChart } from "@/components/PriceChart";
import { formatEur, formatNum } from "@/lib/format";

// Saugyklu serverio adresas — viesas (ne slaptas). Perrasomas per NEXT_PUBLIC_STORAGE_URL.
const STORAGE_URL =
  process.env.NEXT_PUBLIC_STORAGE_URL?.replace(/\/$/, "") || "https://cs2collector-storage.fly.dev";

type Priced = {
  hash: string;
  name: string;
  icon: string | null;
  color: string | null;
  count: number;
  unitEur: number | null;
  totalEur: number | null;
  buffUnitEur?: number | null;
  buffTotalEur?: number | null;
};

type StorageState = {
  importedAt: string;
  units: { name: string; count: number; totalEur: number }[];
  items: Priced[];
  totalEur: number;
  buffTotalEur?: number;
  pricedCount: number;
  unpricedCount: number;
};

type HistoryPoint = { date: string; eur: number };
type ImportUnit = { name?: string; items?: { hash?: string; count?: number }[] };

const histKey = (id: string) => `cs2c:hist:${id}`;
const storageKey = (id: string) => `cs2c:storage:${id}`;
const HASH_PREFIX = "#saugyklos=";

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
    /* nieko */
  }
}

type ExportFile = { units?: ImportUnit[]; items?: { hash?: string; count?: number }[] };

/** Duomenys is programos adreso dalyje po „#saugyklos=" (deflate-raw, base64url) */
async function decodeHashPayload(payload: string): Promise<ImportUnit[]> {
  const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const json = JSON.parse(await new Response(stream).text()) as {
    units?: { name?: string; items?: [string, number][] }[];
  };
  if (!Array.isArray(json.units)) throw new Error("Neatpažinti saugyklų duomenys.");
  return json.units.map((u) => ({ name: u.name, items: (u.items ?? []).map(([hash, count]) => ({ hash, count })) }));
}

type OnlineState = "idle" | "starting" | "qr" | "confirming" | "reading" | "error";

export function ManoPanel({
  steamId,
  inventoryEur,
  inventoryBuffEur = null,
}: {
  steamId: string;
  inventoryEur: number | null;
  inventoryBuffEur?: number | null;
}) {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [storage, setStorage] = useState<StorageState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Nuskaitymo internetu (QR svetaineje) busena
  const [online, setOnline] = useState<OnlineState>("idle");
  const [qrPng, setQrPng] = useState<string | null>(null);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const sessionRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const importUnits = useCallback(
    async (units: ImportUnit[]) => {
      const lines = units.flatMap((u) =>
        (u.items ?? []).map((it) => ({ hash: String(it.hash ?? ""), count: Number(it.count) || 1 })),
      );
      if (!lines.length) throw new Error("Saugyklose nerasta daiktų.");

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
      return state;
    },
    [steamId],
  );

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

  // Automatinis ikelimas is programos (adresas su #saugyklos=)
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith(HASH_PREFIX)) return;
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    let cancelled = false;
    (async () => {
      setError(null);
      setBusy(true);
      try {
        const units = await decodeHashPayload(hash.slice(HASH_PREFIX.length));
        const state = await importUnits(units);
        if (!cancelled) {
          const count = state.units.reduce((s, u) => s + u.count, 0);
          setNotice(`Saugyklos įkeltos: ${state.units.length} saugyklos, ${formatNum(count)} daiktų.`);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Nepavyko įkelti saugyklų.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [importUnits]);

  const stopOnline = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    const id = sessionRef.current;
    sessionRef.current = null;
    if (id && STORAGE_URL) {
      // Paprasom serverio pamirsti sesija (raktas ir taip jau sunaikintas)
      fetch(`${STORAGE_URL}/api/storage/${id}`, { method: "POST", keepalive: true }).catch(() => {});
    }
  }, []);

  useEffect(() => () => stopOnline(), [stopOnline]);

  const startOnline = useCallback(async () => {
    if (!STORAGE_URL) return;
    setOnlineError(null);
    setQrPng(null);
    setOnline("starting");
    try {
      const res = await fetch(`${STORAGE_URL}/api/storage/start`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Nepavyko pradėti");
      sessionRef.current = data.id;
      setQrPng(data.qrPng ?? null);
      setOnline("qr");

      pollRef.current = setInterval(async () => {
        const id = sessionRef.current;
        if (!id) return;
        try {
          const r = await fetch(`${STORAGE_URL}/api/storage/${id}`);
          const j = await r.json();
          if (j.state === "confirming") setOnline("confirming");
          else if (j.state === "reading") setOnline("reading");
          else if (j.state === "done") {
            stopOnline();
            const units: ImportUnit[] = (j.units ?? []).map(
              (u: { name?: string; items?: { hash: string; count: number }[] }) => ({
                name: u.name,
                items: u.items ?? [],
              }),
            );
            const state = await importUnits(units);
            const count = state.units.reduce((s, u) => s + u.count, 0);
            setNotice(`Saugyklos įkeltos: ${state.units.length} saugyklos, ${formatNum(count)} daiktų.`);
            setOnline("idle");
          } else if (j.state === "error" || j.state === "expired") {
            stopOnline();
            setOnlineError(j.error ?? "Nepavyko");
            setOnline("error");
          }
        } catch {
          /* laikinas tinklo trikdis — bandom kitą kartą */
        }
      }, 2500);
    } catch (err) {
      setOnlineError(err instanceof Error ? err.message : "Nepavyko pradėti");
      setOnline("error");
    }
  }, [importUnits, stopOnline]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const parsed = JSON.parse(await file.text()) as ExportFile;
      const units = parsed.units?.length
        ? parsed.units
        : parsed.items
          ? [{ name: "Saugykla", items: parsed.items }]
          : null;
      if (!units) throw new Error("Failas neatpažintas — tikėtasi cs2collector saugyklų failo.");
      await importUnits(units);
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
    setNotice(null);
  }

  const grand = (inventoryEur ?? 0) + (storage?.totalEur ?? 0);
  const onlineBusy = online === "starting" || online === "qr" || online === "confirming" || online === "reading";

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-2xl border border-brand-600/30 bg-gradient-to-br from-brand-600/10 to-transparent p-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-400">Visa kolekcija</p>
        <p className="mt-1 text-4xl font-black tabular-nums text-white">{formatEur(grand)}</p>
        <p className="mt-1 text-sm text-ink-300">
          Inventorius {formatEur(inventoryEur ?? 0)}
          {" + "}saugyklos {storage ? formatEur(storage.totalEur) : "neįkeltos"} · Steam kainomis
        </p>
        {(inventoryBuffEur != null || storage?.buffTotalEur != null) && (
          <p className="mt-0.5 text-sm text-ink-400">
            Buff kainomis:{" "}
            <b className="text-brand-400">{formatEur((inventoryBuffEur ?? 0) + (storage?.buffTotalEur ?? 0))}</b>{" "}
            (inventorius {formatEur(inventoryBuffEur ?? 0)}
            {storage?.buffTotalEur != null ? ` + saugyklos ${formatEur(storage.buffTotalEur)}` : ""})
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
        <h2 className="text-lg font-bold text-white">Storage Unit saugyklos</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-400">
          {STORAGE_URL
            ? "Steam neleidžia svetainėms tiesiogiai matyti, kas yra tavo saugyklose. Nuskenuok QR kodą Steam telefono programėle — saugyklas perskaitysime už tave. Slaptažodžio vesti nereikia, daiktai nekeičiami."
            : "Steam neleidžia svetainėms tiesiogiai matyti, kas yra tavo saugyklose. Jas nuskaito nedidelė programa tavo kompiuteryje — žr. žemiau."}
        </p>

        {notice && !busy && !onlineBusy && (
          <p className="mt-4 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-300">
            ✓ {notice}
          </p>
        )}
        {(error || (onlineError && online === "error")) && (
          <p className="mt-4 text-sm text-red-300">{error || onlineError}</p>
        )}
        {busy && <p className="mt-4 text-sm text-brand-400">Įkeliamos saugyklos…</p>}

        {STORAGE_URL && !storage && !onlineBusy && (
          <button
            type="button"
            onClick={startOnline}
            className="mt-4 rounded-xl bg-gradient-to-b from-brand-400 to-brand-600 px-6 py-3 text-sm font-semibold text-ink-950 transition-all hover:brightness-110"
          >
            {online === "error" ? "Bandyti dar kartą" : "Nuskaityti saugyklas"}
          </button>
        )}

        {onlineBusy && (
          <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-ink-700 bg-ink-900/50 p-5 text-center">
            {qrPng && (online === "qr" || online === "confirming") && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrPng} alt="Steam QR kodas" className="size-56 rounded-lg bg-white p-2" />
            )}
            <p className="text-sm text-ink-200">
              {online === "starting" && "Ruošiamas QR kodas…"}
              {online === "qr" && "Steam programėlė telefone → Steam Guard → nuskenuok šį QR kodą"}
              {online === "confirming" && "Nuskenuota — patvirtink prisijungimą telefone…"}
              {online === "reading" && "Skaitomos saugyklos… tai užtrunka kelias sekundes"}
            </p>
            {(online === "qr" || online === "confirming") && (
              <p className="text-xs text-ink-400">Slaptažodžio vesti nereikia. Kodas galioja kelias minutes.</p>
            )}
            <button type="button" onClick={() => { stopOnline(); setOnline("idle"); }} className="text-xs text-ink-400 underline hover:text-white">
              Atšaukti
            </button>
          </div>
        )}

        {storage && (
          <div className="mt-5 flex flex-col gap-4">
            {STORAGE_URL && !onlineBusy && (
              <button type="button" onClick={startOnline} className="self-start text-xs text-brand-400 underline hover:text-brand-300">
                Atnaujinti saugyklas (nuskaityti iš naujo)
              </button>
            )}
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

        <details className="mt-4 text-xs text-ink-400">
          <summary className="cursor-pointer select-none hover:text-ink-200">Kitas būdas: programa kompiuteryje</summary>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span>
              Gali nuskaityti saugyklas ir su{" "}
              <a
                href="https://github.com/AudriusG2/cs2collector.lt/tree/main/tools/storage-export#readme"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-400 underline hover:text-brand-300"
              >
                programa kompiuteryje
              </a>{" "}
              — ji sukuria failą, kurį įkelk čia:
            </span>
            <label
              className={`cursor-pointer rounded-lg border border-ink-600 px-3 py-1.5 font-semibold text-ink-200 transition-colors hover:border-brand-600 hover:text-brand-400 ${busy ? "pointer-events-none opacity-50" : ""}`}
            >
              Pasirinkti failą
              <input type="file" accept="application/json,.json" onChange={onFile} className="sr-only" />
            </label>
          </div>
        </details>
      </section>
    </div>
  );
}
