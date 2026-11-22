#!/usr/bin/env node
/**
 * Surenka VISO Steam Market CS2 katalogo kainas (~35 500 prekiu), ne tik
 * populiariausias. Steam atiduoda tik 10 prekiu per uzklausa, todel visas
 * katalogas — ~3 550 uzklausu. Kad tilptu i kasdieni darba, renkama dalimis:
 * kiekvienas paleidimas tesia nuo vietos, kur baige ankstesnis (`cursor`), ir
 * rezultatas SUJUNGIAMAS su esamu failu. Taip visas katalogas apeinamas per
 * kelias dienas, o kainos lieka ne senesnes nei kelios dienos.
 *
 * Rikiuojama pagal pavadinima (stabili tvarka), ne pagal populiaruma — kitaip
 * tarp paleidimu prekes perslinktu ir dalis jų niekada nepatektu.
 *
 * Rezultatas — data/steam-all.json:
 *   { updated, currency, total, cursor, count,
 *     items: { [market_hash_name]: [euroCentai, parduodamuKiekis, atnaujintaYYYYMMDD] } }
 *
 * Naudojimas:
 *   node scripts/scrape-steam-all.mjs               # 1500 puslapiu nuo cursor
 *   node scripts/scrape-steam-all.mjs --pages 4000  # visas katalogas
 *   node scripts/scrape-steam-all.mjs --start 0     # nuo pradziu
 *   node scripts/scrape-steam-all.mjs --minutes 50  # baigti po 50 min.
 *
 * Kasdieniame GitHub Action paleidziamas is scrape-prices.mjs pabaigos.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "data", "steam-all.json");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36";
const PAGE_SIZE = 10;
const DELAY_MS = Number(process.env.SCRAPE_DELAY ?? 3000);
const MAX_AGE_DAYS = 30; // senesnes kainos ismetamos
const SAVE_EVERY = 50;

const args = process.argv.slice(2);
const argNum = (name, fallback) => {
  const i = args.indexOf(name);
  return i !== -1 ? Number(args[i + 1]) : fallback;
};
const maxPages = argNum("--pages", 1500);
const startArg = argNum("--start", null);
// Laiko biudzetas minutemis: sustojam patys ir issaugom tiksly cursor
const deadline = Date.now() + argNum("--minutes", Infinity) * 60_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = (d = new Date()) => Number(d.toISOString().slice(0, 10).replaceAll("-", ""));

async function fetchPage(start, attempt = 1) {
  const url =
    `https://steamcommunity.com/market/search/render/?appid=730&norender=1` +
    `&count=${PAGE_SIZE}&start=${start}&currency=3&sort_column=name&sort_dir=asc`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json?.success) throw new Error("success=false");
    return json;
  } catch (err) {
    if (attempt >= 5) throw err;
    const backoff = DELAY_MS * 2 ** attempt;
    console.warn(`  ! start=${start}: ${err.message} — kartoju po ${Math.round(backoff / 1000)}s (${attempt}/5)`);
    await sleep(backoff);
    return fetchPage(start, attempt + 1);
  }
}

async function loadExisting() {
  try {
    const j = JSON.parse(await readFile(OUT, "utf8"));
    return { items: j.items ?? {}, cursor: Number(j.cursor) || 0, total: Number(j.total) || 0 };
  } catch {
    return { items: {}, cursor: 0, total: 0 };
  }
}

async function save(items, cursor, total) {
  await mkdir(path.dirname(OUT), { recursive: true });
  const count = Object.keys(items).length;
  await writeFile(
    OUT,
    JSON.stringify({ updated: new Date().toISOString(), currency: "EUR", total, cursor, count, items }),
  );
  return count;
}

async function main() {
  const existing = await loadExisting();
  const items = existing.items;
  const minStamp = stamp(new Date(Date.now() - MAX_AGE_DAYS * 86_400_000));
  for (const [h, v] of Object.entries(items)) if (!(v?.[2] >= minStamp)) delete items[h];

  let total = existing.total || Infinity;
  let start = startArg ?? existing.cursor;
  if (Number.isFinite(total) && start >= total) start = 0;
  const before = Object.keys(items).length;
  console.log(`Pradedam nuo ${start} · esamų kainų: ${before}`);

  let fresh = 0;
  let page = 0;
  let failedInRow = 0;
  while (page < maxPages) {
    if (Date.now() > deadline) {
      console.log("Baigėsi laiko biudžetas — sustojam.");
      break;
    }
    let json;
    try {
      json = await fetchPage(start);
      failedInRow = 0;
    } catch (err) {
      failedInRow += 1;
      console.warn(`  × start=${start} praleista: ${err.message}`);
      if (failedInRow >= 5) {
        console.warn("Steam nebeatsako — sustojam, tęsim kitą kartą.");
        break;
      }
      start += PAGE_SIZE;
      page += 1;
      await sleep(DELAY_MS * 4);
      continue;
    }

    total = json.total_count || total;
    const today = stamp();
    for (const r of json.results ?? []) {
      const cents = Number(r.sell_price) || 0;
      if (!r.hash_name || cents <= 0) continue; // be pasiulymu — kainos nera
      items[r.hash_name] = [cents, Number(r.sell_listings) || 0, today];
      fresh += 1;
    }

    page += 1;
    start += PAGE_SIZE;
    if (start >= total) start = 0; // apejom visa kataloga — is pradziu

    if (page % SAVE_EVERY === 0) {
      const count = await save(items, start, total);
      console.log(`  ${page}/${maxPages} psl. · cursor ${start}/${total} · ${count} kainų (${fresh} atnaujinta)`);
    }
    if (page < maxPages) await sleep(DELAY_MS);
  }

  if (fresh === 0 && before === 0) throw new Error("Negauta nė vienos kainos — failas nesukurtas");
  const count = await save(items, start, total);
  console.log(`\nOK — ${count} Steam kainų (${fresh} atnaujinta, buvo ${before}); kitas paleidimas nuo ${start}/${total}.`);
}

main().catch((e) => {
  console.error("Klaida:", e.message);
  process.exit(1);
});
