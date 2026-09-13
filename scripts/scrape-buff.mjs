#!/usr/bin/env node
/**
 * Surenka CS2 kainas is Buff.market (viesas katalogas, be prisijungimo) ir
 * perskaiciuoja i eurus pagal ECB kursa. Buff kainos yra artimesnes realiai
 * prekiautoju rinkai nei Steam Market.
 *
 * Buff grieztai riboja greiti: vietoj duomenu grazina „Login Required". Todel:
 *  - rezultatas SUJUNGIAMAS su esamu data/buff.json — praleisti puslapiai
 *    nenutrina anksciau surinktu kainu, kiekvienas paleidimas baze papildo;
 *  - gavus ribojima laukiama ilgiau (COOLDOWN_MS), o ne kartojama is karto;
 *  - daliniai rezultatai issaugomi kas 25 puslapius, kad nutrukus darbui
 *    nieko neprarastume.
 *
 * Rezultatas — data/buff.json:
 *   { updated, source, usdEur, count, items: { [market_hash_name]: [euroCentai, parduodamuKiekis, atnaujintaYYYYMMDD] } }
 *
 * Naudojimas:
 *   node scripts/scrape-buff.mjs                 # visas katalogas
 *   node scripts/scrape-buff.mjs --pages 5       # greitas bandymas
 *   node scripts/scrape-buff.mjs --start 200     # tesiama nuo 200 puslapio
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "data", "buff.json");
const PAGE_SIZE = 80; // Buff daugiau neatiduoda
const DELAY_MS = Number(process.env.BUFF_DELAY ?? 3500);
const COOLDOWN_MS = Number(process.env.BUFF_COOLDOWN ?? 60_000);
const MAX_ATTEMPTS = 4;

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://buff.market/market/csgo",
  Origin: "https://buff.market",
};

const args = process.argv.slice(2);
const argNum = (name, fallback) => {
  const i = args.indexOf(name);
  return i !== -1 ? Number(args[i + 1]) : fallback;
};
const maxPages = argNum("--pages", Infinity);
const startPage = argNum("--start", 1);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = () => Number(new Date().toISOString().slice(0, 10).replaceAll("-", ""));

async function usdToEur() {
  const res = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR", {
    signal: AbortSignal.timeout(20_000),
  });
  const j = await res.json();
  const rate = j?.rates?.EUR;
  if (!(rate > 0)) throw new Error("Nepavyko gauti USD→EUR kurso");
  return rate;
}

async function loadExisting() {
  try {
    const j = JSON.parse(await readFile(OUT, "utf8"));
    return j?.items && typeof j.items === "object" ? j.items : {};
  } catch {
    return {};
  }
}

class RateLimited extends Error {}

async function fetchPage(page) {
  const url = `https://api.buff.market/api/market/goods?game=csgo&page_num=${page}&page_size=${PAGE_SIZE}`;
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  if (j?.code === "Login Required") throw new RateLimited("Buff riboja greitį");
  if (j?.code !== "OK" || !j.data) throw new Error(`atsakymas: ${j?.code ?? "?"}`);
  return j.data;
}

async function fetchWithRetry(page) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fetchPage(page);
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) throw err;
      const wait = err instanceof RateLimited ? COOLDOWN_MS * attempt : DELAY_MS * 2 ** attempt;
      console.warn(`  ! psl. ${page}: ${err.message} — laukiu ${Math.round(wait / 1000)}s (${attempt}/${MAX_ATTEMPTS})`);
      await sleep(wait);
    }
  }
  throw new Error("nepasiekiama");
}

async function save(items, usdEur) {
  await mkdir(path.dirname(OUT), { recursive: true });
  const count = Object.keys(items).length;
  await writeFile(
    OUT,
    JSON.stringify({ updated: new Date().toISOString(), source: "buff.market", usdEur, count, items }),
  );
  return count;
}

async function main() {
  const usdEur = await usdToEur();
  const items = await loadExisting();
  const before = Object.keys(items).length;
  console.log(`USD→EUR: ${usdEur} · esamų Buff kainų: ${before}`);

  const skipped = [];
  let fresh = 0;
  let page = startPage;
  let totalPages = startPage;
  let fetched = 0;

  while (page <= totalPages && fetched < maxPages) {
    let data;
    try {
      data = await fetchWithRetry(page);
    } catch (err) {
      console.warn(`  × psl. ${page} praleistas: ${err.message}`);
      skipped.push(page);
      page += 1;
      fetched += 1;
      await sleep(DELAY_MS);
      continue;
    }

    totalPages = data.total_page ?? page;
    const stamp = today();
    for (const it of data.items ?? []) {
      const usd = Number(it.sell_min_price);
      if (!it.market_hash_name || !(usd > 0)) continue; // be pasiulymu — kainos nera
      items[it.market_hash_name] = [Math.round(usd * usdEur * 100), Number(it.sell_num) || 0, stamp];
      fresh += 1;
    }

    fetched += 1;
    if (page % 25 === 0 || page === totalPages) {
      const count = await save(items, usdEur); // dalinis issaugojimas
      console.log(`  psl. ${page}/${totalPages} — ${count} kainų bazėje (${fresh} atnaujinta šiame paleidime)`);
    }
    page += 1;
    if (page <= totalPages && fetched < maxPages) await sleep(DELAY_MS);
  }

  if (fresh === 0 && before === 0) throw new Error("Negauta nė vienos kainos — failas nesukurtas");

  const count = await save(items, usdEur);
  console.log(`\nOK — ${count} Buff kainų bazėje (${fresh} atnaujinta, anksčiau buvo ${before}) → ${OUT}`);
  if (skipped.length) {
    console.log(`Praleisti puslapiai (${skipped.length}): ${skipped.slice(0, 30).join(", ")}${skipped.length > 30 ? "…" : ""}`);
    console.log(`Tęsti vėliau galima: node scripts/scrape-buff.mjs --start ${skipped[0]}`);
  }
}

main().catch((e) => {
  console.error("Klaida:", e.message);
  process.exit(1);
});
