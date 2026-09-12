import type { Category, Item, RawItem, Rarity } from "./types";

/** Steam retumo spalvos -> lietuviski pavadinimai */
const RARITY_BY_COLOR: Record<string, Rarity> = {
  b0c3d9: { key: "consumer", label: "Pilkas", color: "#b0c3d9" },
  "5e98d9": { key: "industrial", label: "Melsvas", color: "#5e98d9" },
  "4b69ff": { key: "milspec", label: "Mėlynas", color: "#4b69ff" },
  "8847ff": { key: "restricted", label: "Violetinis", color: "#8847ff" },
  d32ce6: { key: "classified", label: "Rožinis", color: "#d32ce6" },
  eb4b4b: { key: "covert", label: "Raudonas", color: "#eb4b4b" },
  e4ae39: { key: "rare", label: "Auksinis", color: "#e4ae39" },
  ffd700: { key: "contraband", label: "Kontrabanda", color: "#ffd700" },
};

const UNKNOWN_RARITY: Rarity = { key: "unknown", label: "Nenurodyta", color: "#8b8f98" };

export function rarityFromColor(color: string): Rarity {
  return RARITY_BY_COLOR[color?.toLowerCase().replace("#", "")] ?? UNKNOWN_RARITY;
}

export const ALL_RARITIES: Rarity[] = Object.values(RARITY_BY_COLOR);

const WEARS: Record<string, string> = {
  "Factory New": "Visiškai nauja",
  "Minimal Wear": "Minimaliai dėvėta",
  "Field-Tested": "Naudota",
  "Well-Worn": "Gerokai dėvėta",
  "Battle-Scarred": "Nuniokota",
};

export function wearFromName(hash: string): string | null {
  const m = hash.match(/\(([^)]+)\)\s*$/);
  return m && WEARS[m[1]] ? m[1] : null;
}

export function wearLabel(wear: string | null): string | null {
  return wear ? (WEARS[wear] ?? wear) : null;
}

export function wearShort(wear: string | null): string | null {
  if (!wear) return null;
  return wear
    .split(/[\s-]/)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function categorise(type: string, hash: string): Category {
  const t = (type || "").toLowerCase();
  const h = (hash || "").toLowerCase();
  if (t.includes("knife") || t.includes("bayonet") || h.includes("★") && t.includes("knife")) return "peilis";
  if (t.includes("glove") || t.includes("wraps")) return "pirstines";
  if (t.includes("container") || h.includes("case") || t.includes("capsule")) return "deze";
  if (t.includes("sticker")) return "lipdukas";
  if (t.includes("agent")) return "agentas";
  if (t.includes("key")) return "raktas";
  if (t.includes("graffiti")) return "grafitis";
  if (t.includes("charm")) return "talismanas";
  if (
    t.includes("rifle") ||
    t.includes("pistol") ||
    t.includes("smg") ||
    t.includes("shotgun") ||
    t.includes("sniper") ||
    t.includes("machinegun") ||
    t.includes("machine gun")
  )
    return "ginklas";
  return "kita";
}

export const CATEGORY_LABELS: Record<Category, string> = {
  ginklas: "Ginklai",
  peilis: "Peiliai",
  pirstines: "Pirštinės",
  deze: "Dėžės",
  lipdukas: "Lipdukai",
  agentas: "Agentai",
  raktas: "Raktai",
  grafitis: "Grafiti",
  talismanas: "Talismanai",
  kita: "Kita",
};

export function iconUrl(i: string | null, size = 128): string | null {
  return i ? `https://community.fastly.steamstatic.com/economy/image/${i}/${size}fx${size}f` : null;
}

export function enrich(raw: RawItem): Item {
  const wear = wearFromName(raw.h);
  return {
    ...raw,
    icon: iconUrl(raw.i),
    rarity: rarityFromColor(raw.c),
    category: categorise(raw.t, raw.h),
    wear,
    statTrak: raw.h.includes("StatTrak"),
    souvenir: raw.h.includes("Souvenir"),
    eur: raw.p / 100,
  };
}

/** Nuima StatTrak/Souvenir/★ priesagas rodymui */
export function baseName(name: string): string {
  return name
    .replace(/^★\s*/, "")
    .replace(/^StatTrak™\s*/, "")
    .replace(/^Souvenir\s*/, "")
    .replace(/\s*\([^)]+\)\s*$/, "")
    .trim();
}
