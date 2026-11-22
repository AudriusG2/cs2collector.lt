#!/usr/bin/env node
/**
 * Surenka CS2 prekiu kainas is Steam Community Market ir issaugo:
 *   data/prices.json          - naujausias pilnas rinkinys
 *   data/history/YYYY-MM-DD.json - tik { hash: kaina } momentine kopija
 *
 * Naudojimas:
 *   node scripts/scrape-prices.mjs            # ~4000 populiariausiu
 *   node scripts/scrape-prices.mjs --all      # visas katalogas (~35k, ~2.5 val.)
 *   node scripts/scrape-prices.mjs --pages 50
 *   node scripts/scrape-prices.mjs --with-all   # + viso katalogo dalis (scrape-steam-all.mjs)
 *
 * GitHub Action'e (GITHUB_ACTIONS) viso katalogo dalis renkama automatiskai —
 * tiek, kiek leidzia darbo laiko limitas (ALL_BUDGET_MIN, numatyta 80 min. viso darbo).
 */
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA = path.join(ROOT, "data");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36";
const PAGE_SIZE = 10; // Steam apriboja rezultatu kieki viename atsakyme
const DELAY_MS = Number(process.env.SCRAPE_DELAY ?? 2600);

const args = process.argv.slice(2);
const wantAll = args.includes("--all");
const pagesArg = args.indexOf("--pages");
const maxPages = wantAll ? Infinity : pagesArg !== -1 ? Number(args[pagesArg + 1]) : 400;
const withAll = args.includes("--with-all") || process.env.GITHUB_ACTIONS === "true";
const STARTED = Date.now();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(start, attempt = 1) {
  const url =
    `https://steamcommunity.com/market/search/render/?appid=730&norender=1` +
    `&count=${PAGE_SIZE}&start=${start}&currency=3&sort_column=popular&sort_dir=desc`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 429 || res.status === 502) throw new Error(`HTTP ${res.status}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json?.success) throw new Error("success=false");
    return json;
  } catch (err) {
    if (attempt >= 5) throw err;
    const backoff = DELAY_MS * 2 ** attempt;
    console.warn(`  ! ${err.message} — kartoju po ${Math.round(backoff / 1000)}s (${attempt}/5)`);
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
    const json = await fetchPage(start);
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

  console.log(`\nOK — ${list.length} prekiu issaugota (${today}). Katalogo dydis: ${total}.`);

  if (withAll && !wantAll) runCatalogPart();
}

/**
 * Likusio katalogo dalis (pigus ir reti daiktai) — atskiru procesu, kad jo klaida
 * nesugadintu jau issaugotu populiariuju kainu. Laikas skaiciuojamas taip, kad
 * visas darbas tilptu i Action limita (90 min.) ir dar liktu laiko commit'ui.
 */
function runCatalogPart() {
  const budget = Number(process.env.ALL_BUDGET_MIN ?? 80);
  const left = Math.floor(budget - (Date.now() - STARTED) / 60_000);
  if (left < 1) {
    console.log("Viso katalogo daliai laiko neliko — praleidžiam.");
    return;
  }
  console.log(`\nRenkama viso katalogo dalis (${left} min.)…`);
  const r = spawnSync(
    process.execPath,
    [path.join(ROOT, "scripts", "scrape-steam-all.mjs"), "--pages", "3600", "--minutes", String(left)],
    { stdio: "inherit", env: process.env },
  );
  if (r.status !== 0) console.warn("Viso katalogo dalis nepavyko — tęsim kitą kartą.");
}

main().catch((e) => {
  console.error("Klaida:", e.message);
  process.exit(1);
});
