import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { enrich } from "./items";
import type { Item, PriceSnapshot } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

export type PriceDb = {
  updated: string;
  total: number;
  items: Item[];
  byHash: Map<string, Item>;
};

const EMPTY: PriceDb = { updated: new Date(0).toISOString(), total: 0, items: [], byHash: new Map() };

/** Ikelia kainu momentine kopija. Kesuojama vienam uzklausos ciklui. */
export const loadPrices = cache(async (): Promise<PriceDb> => {
  try {
    const raw = await readFile(path.join(DATA_DIR, "prices.json"), "utf8");
    const snap = JSON.parse(raw) as PriceSnapshot;
    const items = snap.items.map(enrich);
    return {
      updated: snap.updated,
      total: snap.total || items.length,
      items,
      byHash: new Map(items.map((i) => [i.h, i])),
    };
  } catch {
    return EMPTY;
  }
});

/** Kainos istorija: [{ date, eur }] konkreciai prekei */
export const loadHistory = cache(async (hash: string): Promise<{ date: string; eur: number }[]> => {
  try {
    const idx = JSON.parse(await readFile(path.join(DATA_DIR, "history", "index.json"), "utf8")) as string[];
    const dates = idx.slice(-60);
    const out: { date: string; eur: number }[] = [];
    for (const d of dates) {
      try {
        const day = JSON.parse(await readFile(path.join(DATA_DIR, "history", `${d}.json`), "utf8")) as Record<string, number>;
        if (day[hash] != null) out.push({ date: d, eur: day[hash] / 100 });
      } catch {
        /* praleidziam sugadinta diena */
      }
    }
    return out;
  } catch {
    return [];
  }
});

export type SearchOpts = {
  q?: string;
  category?: string;
  rarity?: string;
  min?: number;
  max?: number;
  sort?: "popular" | "price-asc" | "price-desc" | "name";
  page?: number;
  perPage?: number;
};

export function searchItems(db: PriceDb, opts: SearchOpts) {
  const { q = "", category = "", rarity = "", min, max, sort = "popular", page = 1, perPage = 48 } = opts;
  const needle = q.trim().toLowerCase();

  let out = db.items;
  if (needle) out = out.filter((i) => i.n.toLowerCase().includes(needle));
  if (category) out = out.filter((i) => i.category === category);
  if (rarity) out = out.filter((i) => i.rarity.key === rarity);
  if (min != null && !Number.isNaN(min)) out = out.filter((i) => i.eur >= min);
  if (max != null && !Number.isNaN(max)) out = out.filter((i) => i.eur <= max);

  const sorted = [...out];
  if (sort === "price-asc") sorted.sort((a, b) => a.p - b.p);
  else if (sort === "price-desc") sorted.sort((a, b) => b.p - a.p);
  else if (sort === "name") sorted.sort((a, b) => a.n.localeCompare(b.n, "lt"));
  else sorted.sort((a, b) => b.l - a.l);

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return {
    items: sorted.slice((safePage - 1) * perPage, safePage * perPage),
    count: sorted.length,
    page: safePage,
    totalPages,
  };
}

export type BuffDb = {
  updated: string | null;
  usdEur: number | null;
  byHash: Map<string, { eur: number; listings: number }>;
};

/** Buff.market kainos (data/buff.json). Jei failo nera — tuscia baze, svetaine veikia toliau. */
export const loadBuff = cache(async (): Promise<BuffDb> => {
  try {
    const raw = JSON.parse(await readFile(path.join(DATA_DIR, "buff.json"), "utf8")) as {
      updated: string;
      usdEur: number;
      items: Record<string, [number, number]>;
    };
    const byHash = new Map(
      Object.entries(raw.items).map(([hash, [cents, listings]]) => [hash, { eur: cents / 100, listings }]),
    );
    return { updated: raw.updated, usdEur: raw.usdEur, byHash };
  } catch {
    return { updated: null, usdEur: null, byHash: new Map() };
  }
});
