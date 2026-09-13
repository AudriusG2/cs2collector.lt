import { steamFetch } from "./fetcher";
import { categorise, iconUrl, rarityFromColor, wearFromName } from "./items";
import { loadPrices } from "./prices";
import type { InventoryItem, InventoryResult, StorageUnit } from "./types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const HEADERS = {
  "User-Agent": UA,
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
};

export type SteamErrorCode = "private" | "notfound" | "ratelimit" | "empty" | "network";

export class SteamError extends Error {
  constructor(
    message: string,
    readonly code: SteamErrorCode,
  ) {
    super(message);
    this.name = "SteamError";
  }
}

/* ------------------------------------------------------------------ */
/* Profilio identifikavimas                                            */
/* ------------------------------------------------------------------ */

/** Priima SteamID64, profilio nuoroda arba vanity varda */
export async function resolveSteamId(input: string): Promise<string> {
  const raw = input.trim();
  if (/^7656119\d{10}$/.test(raw)) return raw;

  const url = raw.match(/steamcommunity\.com\/(profiles|id)\/([^/?#\s]+)/i);
  if (url) {
    const [, kind, value] = url;
    if (kind.toLowerCase() === "profiles" && /^7656119\d{10}$/.test(value)) return value;
    return resolveVanity(value);
  }
  if (/^[a-zA-Z0-9_.-]{2,64}$/.test(raw)) return resolveVanity(raw);
  throw new SteamError("Neatpažintas Steam profilio formatas", "notfound");
}

async function resolveVanity(vanity: string): Promise<string> {
  const key = process.env.STEAM_API_KEY;

  if (key) {
    const res = await steamFetch(
      `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${key}&vanityurl=${encodeURIComponent(vanity)}`,
      { headers: HEADERS, timeoutMs: 12_000, revalidate: 86_400 },
    ).catch(() => null);
    const json = (await res?.json().catch(() => null)) as
      | { response?: { success?: number; steamid?: string } }
      | null
      | undefined;
    if (json?.response?.success === 1 && json.response.steamid) return json.response.steamid;
  }

  // Atsarginis variantas be API rakto: profilio XML isklotine
  const res = await steamFetch(`https://steamcommunity.com/id/${encodeURIComponent(vanity)}?xml=1`, {
    headers: HEADERS,
    timeoutMs: 12_000,
    revalidate: 86_400,
  }).catch(() => null);
  const xml = (await res?.text().catch(() => "")) ?? "";
  const m = xml.match(/<steamID64>(\d+)<\/steamID64>/);
  if (!m) throw new SteamError("Toks Steam profilis nerastas", "notfound");
  return m[1];
}

export async function getProfile(steamId: string) {
  try {
    const res = await steamFetch(`https://steamcommunity.com/profiles/${steamId}?xml=1`, {
      headers: HEADERS,
      timeoutMs: 10_000,
      revalidate: 86_400,
    });
    const xml = await res.text();
    const name = xml.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/)?.[1] ?? null;
    const avatar = xml.match(/<avatarMedium><!\[CDATA\[(.*?)\]\]><\/avatarMedium>/)?.[1] ?? null;
    return name || avatar ? { name, avatar } : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Inventoriaus nuskaitymas                                            */
/* ------------------------------------------------------------------ */

/** Bendras vidinis pavidalas, i kuri suvedami abu Steam formatai */
type NormalisedEntry = {
  hash: string;
  name: string;
  icon: string;
  type: string;
  color: string;
  tradable: boolean;
  marketable: boolean;
  count: number;
  /** Kiek daiktu paslepta viduje (tik Storage Unit atveju) */
  storedCount: number;
};

/** Naujasis /inventory/<id>/730/2 formatas */
type ModernInventory = {
  assets?: { classid: string; instanceid: string; amount: string }[];
  descriptions?: {
    classid: string;
    instanceid: string;
    market_hash_name: string;
    name: string;
    icon_url: string;
    type: string;
    name_color?: string;
    tradable: number;
    marketable?: number;
    descriptions?: { value?: string }[];
  }[];
};

/** Senasis /profiles/<id>/inventory/json/730/2 formatas */
type LegacyInventory = {
  success?: boolean;
  Error?: string;
  rgInventory?: Record<string, { classid: string; instanceid: string; amount: string }>;
  rgDescriptions?: Record<
    string,
    {
      market_hash_name: string;
      name: string;
      icon_url: string;
      type: string;
      name_color?: string;
      tradable: number;
      marketable?: number;
      descriptions?: { value?: string }[];
    }
  >;
};

/**
 * Storage Unit turinio Steam viesai neatiduoda — matomas tik daiktu kiekis
 * aprasymo eiluteje „Number of Items: 245". Ta skaiciu ir istraukiam, kad
 * galetume perspeti, jog i verte jie neiskaiciuoti.
 */
function storedCountOf(desc: { type?: string; descriptions?: { value?: string }[] }): number {
  if (!/storage unit|casket/i.test(desc.type ?? "")) {
    const lines = desc.descriptions ?? [];
    const hasCount = lines.some((l) => /number of items/i.test(l.value ?? ""));
    if (!hasCount) return 0;
  }
  for (const line of desc.descriptions ?? []) {
    const m = (line.value ?? "").match(/number of items:\s*([\d.,\s]+)/i);
    if (m) {
      const n = Number(m[1].replace(/[^\d]/g, ""));
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

function fromModern(json: ModernInventory): NormalisedEntry[] | null {
  if (!json.assets?.length || !json.descriptions?.length) return null;
  const byKey = new Map(json.descriptions.map((d) => [`${d.classid}_${d.instanceid}`, d]));
  const out = new Map<string, NormalisedEntry>();
  for (const a of json.assets) {
    const d = byKey.get(`${a.classid}_${a.instanceid}`);
    if (!d?.market_hash_name) continue;
    const amount = Number(a.amount) || 1;
    const cur = out.get(d.market_hash_name);
    if (cur) {
      cur.count += amount;
      cur.storedCount += storedCountOf(d);
    } else {
      out.set(d.market_hash_name, {
        hash: d.market_hash_name,
        name: d.name,
        icon: d.icon_url,
        type: d.type,
        color: d.name_color ?? "",
        tradable: d.tradable === 1,
        marketable: d.marketable === 1,
        count: amount,
        storedCount: storedCountOf(d),
      });
    }
  }
  return out.size ? [...out.values()] : null;
}

function fromLegacy(json: LegacyInventory): NormalisedEntry[] | null {
  const assets = Object.values(json.rgInventory ?? {});
  const descs = json.rgDescriptions ?? {};
  if (!assets.length || !Object.keys(descs).length) return null;
  const out = new Map<string, NormalisedEntry>();
  for (const a of assets) {
    const d = descs[`${a.classid}_${a.instanceid}`];
    if (!d?.market_hash_name) continue;
    const amount = Number(a.amount) || 1;
    const cur = out.get(d.market_hash_name);
    if (cur) {
      cur.count += amount;
      cur.storedCount += storedCountOf(d);
    } else {
      out.set(d.market_hash_name, {
        hash: d.market_hash_name,
        name: d.name,
        icon: d.icon_url,
        type: d.type,
        color: d.name_color ?? "",
        tradable: d.tradable === 1,
        marketable: d.marketable === 1,
        count: amount,
        storedCount: storedCountOf(d),
      });
    }
  }
  return out.size ? [...out.values()] : null;
}

async function get(url: string) {
  return steamFetch(url, { headers: HEADERS, timeoutMs: 25_000, revalidate: 900 });
}

/**
 * Senasis galinis taskas vis dar atsako be autentifikacijos, todel bandomas
 * pirmas; naujasis lieka atsarginiu. Abu grieztai riboja uzklausu daznuma.
 */
async function fetchEntries(steamId: string): Promise<NormalisedEntry[]> {
  let sawRateLimit = false;
  let sawPrivate = false;

  // 1) Senasis formatas
  try {
    const res = await get(`https://steamcommunity.com/profiles/${steamId}/inventory/json/730/2`);
    if (res.status === 429) sawRateLimit = true;
    else if (res.ok) {
      const json = (await res.json().catch(() => null)) as LegacyInventory | null;
      if (json) {
        if (json.success === false) {
          if (/private/i.test(json.Error ?? "")) sawPrivate = true;
        } else {
          const entries = fromLegacy(json);
          if (entries) return entries;
        }
      }
    } else if (res.status === 403) sawPrivate = true;
  } catch {
    /* krentam i antra varianta */
  }

  // 2) Naujasis formatas
  try {
    const res = await get(`https://steamcommunity.com/inventory/${steamId}/730/2?l=english&count=2000`);
    if (res.status === 429 || res.status === 401) sawRateLimit = true;
    else if (res.status === 403) sawPrivate = true;
    else if (res.ok) {
      const json = (await res.json().catch(() => null)) as ModernInventory | null;
      const entries = json ? fromModern(json) : null;
      if (entries) return entries;
    }
  } catch {
    /* tesiam i klaidu apdorojima */
  }

  if (sawPrivate)
    throw new SteamError(
      "Inventorius privatus — Steam nustatymuose padaryk jį viešą ir pabandyk vėl",
      "private",
    );
  if (sawRateLimit)
    throw new SteamError(
      "Steam šiuo metu riboja užklausas iš mūsų serverio. Pabandyk po kelių minučių.",
      "ratelimit",
    );
  throw new SteamError("Inventorius tuščias arba nepasiekiamas", "empty");
}

export async function getInventoryValue(steamId: string): Promise<InventoryResult> {
  const [entries, db, profile] = await Promise.all([
    fetchEntries(steamId),
    loadPrices(),
    getProfile(steamId),
  ]);

  const items: InventoryItem[] = [];
  const storageUnits: StorageUnit[] = [];
  let totalEur = 0;
  let pricedCount = 0;
  let unpricedCount = 0;
  let itemCount = 0;
  let storedItemCount = 0;

  for (const e of entries) {
    if (e.storedCount > 0) {
      storageUnits.push({
        hash: e.hash,
        name: e.name,
        icon: iconUrl(e.icon),
        storedCount: e.storedCount,
      });
      storedItemCount += e.storedCount;
    }

    const price = db.byHash.get(e.hash);
    const unitEur = price ? price.eur : null;
    const totalItemEur = unitEur != null ? unitEur * e.count : null;

    if (totalItemEur != null) {
      totalEur += totalItemEur;
      pricedCount += e.count;
    } else {
      unpricedCount += e.count;
    }
    itemCount += e.count;

    items.push({
      hash: e.hash,
      name: e.name,
      icon: iconUrl(e.icon),
      count: e.count,
      unitEur,
      totalEur: totalItemEur,
      rarity: rarityFromColor(e.color),
      category: categorise(e.type, e.hash),
      wear: wearFromName(e.hash),
      statTrak: e.hash.includes("StatTrak"),
      tradable: e.tradable,
      marketable: e.marketable,
    });
  }

  items.sort((a, b) => (b.totalEur ?? -1) - (a.totalEur ?? -1));

  return {
    steamId,
    profile,
    items,
    totalEur,
    pricedCount,
    unpricedCount,
    itemCount,
    storageUnits: storageUnits.sort((a, b) => b.storedCount - a.storedCount),
    storedItemCount,
    updated: db.updated,
  };
}
