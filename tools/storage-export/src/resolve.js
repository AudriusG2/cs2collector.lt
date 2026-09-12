/**
 * GC daikto vertimas i Steam Market pavadinima pagal cs2collector item-map.json.
 * Atskiras modulis, kad logika butu testuojama be prisijungimo prie Steam.
 */

// Daiktu def_index, kuriu pavadinimas nustatomas pagal papildoma atributa
export const DEF_STORAGE_UNIT = 1201;
const DEF_STICKER = 1209;
const DEF_GRAFFITI = 1348;
const DEF_GRAFFITI_ALT = 1349;
const DEF_MUSIC_KIT = 1314;
const DEF_PATCH = 4609;
const DEF_KEYCHAIN = 1355;

// Atributu numeriai, kuriu globaloffensive biblioteka neapdoroja
const ATTR_MUSIC_ID = 166;
const ATTR_KEYCHAIN_ID = 299;
const ATTR_SPRAY_TINT = 233;

const QUALITY_STATTRAK = 9;
const QUALITY_SOUVENIR = 12;

export function wearIndex(w) {
  if (typeof w !== "number") return "";
  if (w < 0.07) return 0;
  if (w < 0.15) return 1;
  if (w < 0.38) return 2;
  if (w < 0.45) return 3;
  return 4;
}

function attrUInt(item, defIndex) {
  const a = (item.attribute || []).find((x) => x.def_index == defIndex);
  return a?.value_bytes ? a.value_bytes.readUInt32LE(0) : null;
}

/** Grazina Steam Market pavadinima arba null, jei daiktas neatpazintas */
export function resolveHash(item, map) {
  const def = item.def_index;
  const st = item.quality === QUALITY_STATTRAK || item.kill_eater_value != null ? 1 : 0;
  const sv = item.quality === QUALITY_SOUVENIR ? 1 : 0;

  if (def === DEF_STICKER) return map.stickers[String(item.stickers?.[0]?.sticker_id)] ?? null;
  if (def === DEF_PATCH) return map.patches[String(item.stickers?.[0]?.sticker_id)] ?? null;
  if (def === DEF_GRAFFITI || def === DEF_GRAFFITI_ALT) {
    const kit = item.stickers?.[0]?.sticker_id;
    const tint = attrUInt(item, ATTR_SPRAY_TINT);
    return map.graffiti[`${kit}_${tint}`] ?? map.graffiti[String(kit)] ?? null;
  }
  if (def === DEF_MUSIC_KIT) {
    const base = map.music[String(attrUInt(item, ATTR_MUSIC_ID))];
    return base ? (st ? `StatTrak™ ${base}` : base) : null;
  }
  if (def === DEF_KEYCHAIN) return map.keychains[String(attrUInt(item, ATTR_KEYCHAIN_ID))] ?? null;

  if (item.paint_index != null) {
    const paint = Math.round(item.paint_index);
    const hit = map.skins[`${def}_${paint}_${wearIndex(item.paint_wear)}_${st}_${sv}`];
    if (hit) return hit;
  }
  // Neapdirbti peiliai / pirstines
  const vanilla = map.skins[`${def}_0__${st}_${sv}`];
  if (vanilla) return vanilla;

  return map.defs[String(def)] ?? null;
}
