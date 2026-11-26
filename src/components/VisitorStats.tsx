"use client";

import { useEffect, useState } from "react";
import { formatNum } from "@/lib/format";

// Lankytoju skaitiklio adresas (Cloudflare Worker, stats/ katalogas). Viesas, ne slaptas.
export const STATS_URL =
  process.env.NEXT_PUBLIC_STATS_URL?.replace(/\/$/, "") || "https://cs2collector-stats.girgzdysaudrius.workers.dev";

type Stats = { today: number; record: { day: string; count: number } | null; total: number };

/** Siandienos lankytojai, rekordas ir is viso — svetaines apacioje */
export function VisitorStats() {
  const [s, setS] = useState<Stats | null>(null);

  useEffect(() => {
    if (!STATS_URL) return;
    const ctrl = new AbortController();
    fetch(`${STATS_URL}/hit`, { method: "POST", signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Stats | null) => j && setS(j))
      .catch(() => {
        /* skaitiklis neprivalomas — klaidos nerodom */
      });
    return () => ctrl.abort();
  }, []);

  if (!s) return null;
  const recordDay = s.record?.day.slice(5); // MM-DD
  return (
    <p className="text-xs tabular-nums text-ink-400" title="Unikalūs lankytojai (skaičiuojama be slapukų)">
      👥 Šiandien <b className="text-ink-200">{formatNum(s.today)}</b>
      {s.record && (
        <>
          {" · "}rekordas <b className="text-ink-200">{formatNum(s.record.count)}</b> ({recordDay})
        </>
      )}
      {" · "}iš viso <b className="text-ink-200">{formatNum(s.total)}</b>
    </p>
  );
}
