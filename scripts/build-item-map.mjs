#!/usr/bin/env node
/**
 * Sugeneruoja public/item-map.json — kompaktiska CS2 daiktu zemelapi, kuriuo
 * saugyklu eksporto programa (tools/storage-export) verta zaidimo koordinatoriaus
 * duomenis (def_index, paint_index, atributai) i Steam Market pavadinimus.
 *
 * Saltinis: https://github.com/ByMykel/CSGO-API (MIT)
 *
 * Naudojimas: node scripts/build-item-map.mjs
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public", "item-map.json");
const API = "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en";

const WEAR_IDX = {
  "Factory New": 0,
  "Minimal Wear": 1,
  "Field-Tested": 2,
  "Well-Worn": 3,
  "Battle-Scarred": 4,
};

async function load(name) {
  const res = await fetch(`${API}/${name}.json`, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const data = await res.json();
  console.log(`  ${name.padEnd(18)} ${data.length} įrašų`);
  return data;
}

const hashOf = (it) => it.market_hash_name || it.name;

async function main() {
  console.log("Siunčiami šaltiniai…");
  const [skins, stickers, crates, agents, keychains, collectibles, musicKits, graffiti, patches, keys, tools] =
    await Promise.all(
      [
        "skins_not_grouped",
        "stickers",
        "crates",
        "agents",
        "keychains",
        "collectibles",
        "music_kits",
        "graffiti",
        "patches",
        "keys",
        "tools",
      ].map(load),
    );

  /*
   * skins: "<weapon_def>_<paint>_<wear>_<statTrak>_<souvenir>" -> pavadinimas
   *   paint = 0 ir wear = "" — neapdirbti peiliai/pirstines („vanilla")
   */
  const skinMap = {};
  for (const s of skins) {
    const def = s.weapon?.weapon_id;
    if (def == null) continue;
    const paint = s.paint_index ? Number(s.paint_index) : 0;
    const wear = s.wear?.name != null && WEAR_IDX[s.wear.name] != null ? WEAR_IDX[s.wear.name] : "";
    skinMap[`${def}_${paint}_${wear}_${s.stattrak ? 1 : 0}_${s.souvenir ? 1 : 0}`] = hashOf(s);
  }

  const byDef = (arr) => Object.fromEntries(arr.filter((i) => i.def_index != null).map((i) => [String(i.def_index), hashOf(i)]));

  // Paprasti daiktai, identifikuojami vien def_index
  const defs = { ...byDef(tools), ...byDef(keys), ...byDef(collectibles), ...byDef(agents), ...byDef(crates) };

  // Sealed Graffiti: skirtingos spalvos turi ta pati kit ID, bet skirtinga color_index
  const graffitiMap = {};
  for (const g of graffiti) {
    if (g.def_index == null) continue;
    const key = g.color_index != null ? `${g.def_index}_${g.color_index}` : String(g.def_index);
    graffitiMap[key] = hashOf(g);
    graffitiMap[String(g.def_index)] ??= hashOf(g);
  }

  // Muzikos rinkiniai: market_hash_name saltinyje daznai tuscias — sudarom patys
  const music = {};
  for (const m of musicKits) {
    if (m.def_index == null) continue;
    const base = m.name.replace(/^StatTrak™\s*/, "").replace(/^Music Kit \|\s*/, "");
    music[String(m.def_index)] = `Music Kit | ${base}`;
  }

  const map = {
    version: 1,
    generated: new Date().toISOString(),
    source: "github.com/ByMykel/CSGO-API",
    skins: skinMap,
    defs,
    stickers: byDef(stickers),
    patches: byDef(patches),
    graffiti: graffitiMap,
    keychains: byDef(keychains),
    music,
  };

  await mkdir(path.dirname(OUT), { recursive: true });
  const json = JSON.stringify(map);
  await writeFile(OUT, json);
  console.log(
    `\nOK — ${OUT}\n  skinai ${Object.keys(skinMap).length}, def ${Object.keys(defs).length}, ` +
      `lipdukai ${Object.keys(map.stickers).length}, muzika ${Object.keys(music).length}, ` +
      `dydis ${(json.length / 1024 / 1024).toFixed(2)} MB`,
  );
}

main().catch((e) => {
  console.error("Klaida:", e.message);
  process.exit(1);
});
