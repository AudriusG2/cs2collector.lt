#!/usr/bin/env node
/**
 * Surenka CS2 prekiu kainas is Steam Community Market ir issaugo:
 *   data/prices.json          - naujausias pilnas rinkinys
 *   data/history/YYYY-MM-DD.json - tik { hash: kaina } momentine kopija
 *
 * Naudojimas:
 * Nuo 2026-11-26 naudojama nauja Steam paieskos API (zr. steam-search.mjs):
 * 100 prekiu per puslapi, todel 400 puslapiu apima visa sugrupuota kataloga (~14k).
 *
 *   node scripts/scrape-prices.mjs            # iki 400 puslapiu (visas katalogas)
 *   node scripts/scrape-prices.mjs --all      # visas katalogas (~35k, ~2.5 val.)
 *   node scripts/scrape-prices.mjs --pages 50
 *   node scripts/scrape-prices.mjs --with-all   # + viso katalogo dalis (scrape-steam-all.mjs)
 *
 * GitHub Action'e (GITHUB_ACTIONS) surinktos kainos dar sujungiamos i data/steam-all.json
 * (atskiro viso katalogo rinkimo nebereikia). Jei Steam nutraukia rinkima (HTTP 429),
 * issaugoma tai, kas surinkta, o kitoms prekems paliekamos ankstesnes kainos.
 */
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA = path.join(ROOT, "data");
import { searchPage, SORT, PAGE_SIZE } from "./steam-search.mjs";
// Nauja Steam API riboja ~100 uzklausu per kelias minutes — ne greiciau kaip kas 4,5 s
const DELAY_MS = Math.max(4500, Number(process.env.SCRAPE_DELAY ?? 4500));

const args = process.argv.slice(2);
const wantAll = args.includes("--all");
const pagesArg = args.indexOf("--pages");
const maxPages = wantAll ? Infinity : pagesArg !== -1 ? Number(args[pagesArg + 1]) : 400;
const withAll = args.includes("--with-all") || process.env.GITHUB_ACTIONS === "true";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MAX_TRIES = 7;

async function fetchPage(start, attempt = 1) {
  try {
    return await searchPage({ start, count: PAGE_SIZE, order: SORT.popular });
  } catch (err) {
    if (attempt >= MAX_TRIES) throw err;
    // 429 = Steam laikinai riboja (~100 uzklausu per kelias min.) — laukiam minutemis
    const backoff = err.message.includes("429") ? 60_000 * attempt : DELAY_MS * 2 ** attempt;
    console.warn(`  ! ${err.message} — kartoju po ${Math.round(backoff / 1000)}s (${attempt}/${MAX_TRIES})`);
    await sleep(backoff);
    return fetchPage(start, attempt + 1);
  }
}

/** Steam icon_url -> pilnas CDN adresas */
const iconUrl = (u) => (u ? `https://community.fastly.steamstatic.com/economy/image/${u}/128fx128f` : null);

function normalise(r) {
  const d = r.asset_description ?? {};
  return {
    h: r.hash_name,
    n: r.name,
    p: r.sell_price ?? 0,          // centai, EUR
    l: r.sell_listings ?? 0,       // parduodamu kiekis
    i: d.icon_url ?? null,
    t: d.type ?? "",
    c: d.name_color ?? "",         // retumo spalva
  };
}

async function main() {
  await mkdir(path.join(DATA, "history"), { recursive: true });
  const items = new Map();
  let start = 0;
  let total = Infinity;
  let page = 0;

  while (start < total && page < maxPages) {
    let json;
    try {
      json = await fetchPage(start);
    } catch (err) {
      if (items.size === 0) throw err;
      // Dalis jau surinkta — issaugom ja, likusios prekes pasiliks vakar dienos kainas
      console.warn(`Steam nebeatsako (${err.message}) — saugom ${items.size} surinktų kainų.`);
      break;
    }
    total = json.total_count ?? 0;
    for (const r of json.results ?? []) {
      const it = normalise(r);
      if (it.h) items.set(it.h, it);
    }
    page += 1;
    start += PAGE_SIZE;
    const pct = Math.min(100, Math.round((start / Math.min(total, maxPages * PAGE_SIZE)) * 100));
    console.log(`  ${String(pct).padStart(3)}% — ${items.size} prekiu (is ${total})`);
    if (start < total && page < maxPages) await sleep(DELAY_MS);
  }

  const freshList = [...items.values()];
  const fresh = freshList.length;
  if (start < total) await keepOldPrices(items);

  const list = [...items.values()].sort((a, b) => b.l - a.l);
  const today = new Date().toISOString().slice(0, 10);

  // Pilnas rinkinys
  const snapshot = { updated: new Date().toISOString(), currency: "EUR", total, count: list.length, items: list };
  await writeFile(path.join(DATA, "prices.json"), JSON.stringify(snapshot));

  // Lieknas istorijos irasas: hash -> centai
  const slim = Object.fromEntries(list.map((i) => [i.h, i.p]));
  await writeFile(path.join(DATA, "history", `${today}.json`), JSON.stringify(slim));

  // Istorijos indeksas
  const idxPath = path.join(DATA, "history", "index.json");
  const idx = existsSync(idxPath) ? JSON.parse(await readFile(idxPath, "utf8")) : [];
  if (!idx.includes(today)) idx.push(today);
  idx.sort();
  await writeFile(idxPath, JSON.stringify(idx));

  console.log(`\nOK — ${list.length} prekiu issaugota, ${fresh} atnaujinta (${today}). Katalogo dydis: ${total}.`);

  if (withAll && !wantAll) await mergeIntoSteamAll(freshList, today);
}

/** Jei Steam nutrauke rinkima pusiaukeleje — neatnaujintoms prekems paliekam ankstesnes kainas. */
async function keepOldPrices(items) {
  try {
    const old = JSON.parse(await readFile(path.join(DATA, "prices.json"), "utf8"));
    let kept = 0;
    for (const it of old.items ?? []) if (it.h && !items.has(it.h)) (items.set(it.h, it), kept++);
    console.log(`Palikta ${kept} ankstesnių kainų.`);
  } catch {}
}

/**
 * Nauja Steam API per viena paleidima apeina visa (sugrupuota) kataloga, todel
 * atskiro scrape-steam-all.mjs rinkimo nebereikia — tas pacias kainas tiesiog
 * sujungiam i data/steam-all.json (formatas: [euroCentai, kiekis, YYYYMMDD]).
 * Kitu nusidevejimo versiju senos kainos islieka iki 30 dienu.
 */
async function mergeIntoSteamAll(list, today) {
  const file = path.join(DATA, "steam-all.json");
  let all = { items: {} };
  try {
    all = JSON.parse(await readFile(file, "utf8"));
  } catch {}
  const items = all.items ?? {};
  const stampToday = Number(today.replaceAll("-", ""));
  const minStamp = Number(new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10).replaceAll("-", ""));
  let updated = 0;
  for (const it of list) {
    if (!it.h || !(it.p > 0)) continue;
    items[it.h] = [it.p, it.l, stampToday];
    updated += 1;
  }
  for (const [h, v] of Object.entries(items)) if (!(v?.[2] >= minStamp)) delete items[h];
  const count = Object.keys(items).length;
  await writeFile(
    file,
    JSON.stringify({ ...all, updated: new Date().toISOString(), currency: "EUR", count, items }),
  );
  console.log(`steam-all.json: ${count} kainų (${updated} atnaujinta).`);
}

main().catch((e) => {
  console.error("Klaida:", e.message);
  process.exit(1);
});
