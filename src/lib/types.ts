export type RawItem = {
  h: string; // market_hash_name
  n: string; // rodomas pavadinimas
  p: number; // kaina centais (EUR)
  l: number; // parduodamu skelbimu kiekis
  i: string | null; // Steam icon_url
  t: string; // tipas, pvz. "Covert Rifle"
  c: string; // retumo spalva HEX be #
};

export type PriceSnapshot = {
  updated: string;
  currency: string;
  total: number;
  count: number;
  items: RawItem[];
};

export type Rarity = {
  key: string;
  label: string;
  color: string;
};

export type Category =
  | "ginklas"
  | "peilis"
  | "pirstines"
  | "deze"
  | "lipdukas"
  | "agentas"
  | "raktas"
  | "grafitis"
  | "talismanas"
  | "kita";

export type Item = RawItem & {
  icon: string | null;
  rarity: Rarity;
  category: Category;
  wear: string | null;
  statTrak: boolean;
  souvenir: boolean;
  eur: number;
};

export type InventoryItem = {
  hash: string;
  name: string;
  icon: string | null;
  count: number;
  unitEur: number | null;
  totalEur: number | null;
  /** Buff.market kaina eurais (pigiausias pasiulymas) */
  buffUnitEur: number | null;
  buffTotalEur: number | null;
  rarity: Rarity;
  category: Category;
  wear: string | null;
  statTrak: boolean;
  tradable: boolean;
  /** Ar Steam leidzia prekiauti Market'e (medaliai, monetos, C4 — ne) */
  marketable: boolean;
};

/** Storage Unit (saugyklos konteineris) — Steam viesai neatiduoda jo turinio */
export type StorageUnit = {
  hash: string;
  name: string;
  icon: string | null;
  storedCount: number;
};

export type InventoryResult = {
  steamId: string;
  profile: { name: string | null; avatar: string | null } | null;
  items: InventoryItem[];
  totalEur: number;
  pricedCount: number;
  unpricedCount: number;
  itemCount: number;
  /** Saugyklos ir jose paslepti daiktai — i verte neiskaiciuojami */
  storageUnits: StorageUnit[];
  storedItemCount: number;
  updated: string;
  /** Buff.market vertes suvestine (null, jei Buff duomenu dar nera) */
  buffTotalEur: number;
  buffPricedCount: number;
  buffUpdated: string | null;
};
