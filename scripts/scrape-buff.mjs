#!/usr/bin/env node
/**
 * Surenka CS2 kainas is Buff.market (viesas katalogas, be prisijungimo) ir
 * perskaiciuoja i eurus pagal ECB kursa. Buff kainos yra artimesnes realiai
 * prekiautoju rinkai nei Steam Market.
 *
 * Rezultatas — data/buff.json:
 *   { updated, source, usdEur, count, items: { [market_hash_name]: [euroCentai, parduodamuKiekis] } }
 *
 * Naudojimas:
 *   node scripts/scrape-buff.mjs              # visas katalogas (~425 psl., ~10 min)
 *   node scripts/scrape-buff.mjs --pages 5    # greitas bandymas
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "data", "buff.json");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36";
const PAGE_SIZE = 80; // Buff daugiau neatiduoda
const DELAY_MS = Number(process.env.BUFF_DELAY ?? 1200);

const args = process.argv.slice(2);
const pagesArg = args.indexOf("--pages");
const maxPages = pagesArg !== -1 ? Number(args[pagesArg + 1]) : Infinity;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function usdToEur() {
  const res = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR", {
    signal: AbortSignal.timeout(20_000),
  });
  const j = await res.json();
  const rate = j?.rates?.EUR;
  if (!(rate > 0)) throw new Error("Nepavyko gauti USD→EUR kurso");
  return rate;
}

async function fetchPage(page, attempt = 1) {
  const url = `https://api.buff.market/api/market/goods?game=csgo&page_num=${page}&page_size=${PAGE_SIZE}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    if (j?.code !== "OK" || !j.data) throw new Error(`atsakymas: ${j?.code ?? "?"}`);
    return j.data;
  } catch (err) {
    if (attempt >= 5) throw err;
    const backoff = DELAY_MS * 2 ** attempt;
    console.warn(`  ! psl. ${page}: ${err.message} — kartoju po ${Math.round(backoff / 1000)}s (${attempt}/5)`);
    await sleep(backoff);
    return fetchPage(page, attempt + 1);
  }
}

async function main() {
  const usdEur = await usdToEur();
  console.log(`USD→EUR: ${usdEur}`);

  const items = {};
  const skipped = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= maxPages) {
    let data;
    try {
      data = await fetchPage(page);
    } catch (err) {
      // Vienas nepasiekiamas puslapis neturi sugadinti viso surinkimo
      console.warn(`  × psl. ${page} praleistas: ${err.message}`);
      skipped.push(page);
      page += 1;
      if (page <= totalPages && page <= maxPages) await sleep(DELAY_MS);
      continue;
    }
    totalPages = data.total_page ?? page;
    for (const it of data.items ?? []) {
      const usd = Number(it.sell_min_price);
      if (!it.market_hash_name || !(usd > 0)) continue; // be pasiulymu — kainos nera
      items[it.market_hash_name] = [Math.round(usd * usdEur * 100), Number(it.sell_num) || 0];
    }
    if (page % 25 === 0 || page === totalPages) {
      console.log(`  psl. ${page}/${totalPages} — ${Object.keys(items).length} prekių su kaina`);
    }
    page += 1;
    if (page <= totalPages && page <= maxPages) await sleep(DELAY_MS);
  }

  const count = Object.keys(items).length;
  if (count === 0) throw new Error("Negauta nė vienos kainos — failas neperrašomas");

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify({ updated: new Date().toISOString(), source: "buff.market", usdEur, count, items }),
  );
  console.log(`\nOK — ${count} Buff kainų išsaugota į ${OUT}`);
  if (skipped.length) {
    console.log(`Praleisti puslapiai (${skipped.length}): ${skipped.slice(0, 20).join(", ")}${skipped.length > 20 ? "…" : ""}`);
  }
}

main().catch((e) => {
  console.error("Klaida:", e.message);
  process.exit(1);
});
