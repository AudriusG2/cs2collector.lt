#!/usr/bin/env node
/**
 * cs2collector.lt — Storage Unit eksporto programa
 *
 * Veikia TAVO kompiuteryje. Prisijungimas — QR kodu per Steam telefono programele,
 * todel slaptazodzio vesti nereikia visai. Programa nieko nesiuncia i cs2collector.lt:
 * tik parsisiuncia vieso daiktu zemelapio faila ir sukuria vietini .json faila,
 * kuri pats ikelsi svetaineje.
 *
 * Tik skaitymas: jokie daiktai neperkeliami, neparduodami ir nekeiciami.
 */
import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { DEF_STORAGE_UNIT, resolveHash } from "./resolve.js";

const require = createRequire(import.meta.url);
const SteamUser = require("steam-user");
const GlobalOffensive = require("globaloffensive");
const { LoginSession, EAuthTokenPlatformType } = require("steam-session");
const qrcode = require("qrcode-terminal");
const QRCode = require("qrcode");

const MAP_URL = process.env.CS2C_MAP_URL ?? "https://cs2collector.lt/item-map.json";
const CS2_APP_ID = 730;
const GC_TIMEOUT_MS = 90_000;

const log = (...a) => console.log(...a);

async function loadMap() {
  const local = process.env.CS2C_MAP_FILE;
  if (local) return JSON.parse(await readFile(local, "utf8"));
  const res = await fetch(MAP_URL, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Nepavyko parsisiųsti daiktų žemėlapio (${res.status})`);
  return res.json();
}

async function loginWithQr() {
  const session = new LoginSession(EAuthTokenPlatformType.SteamClient);
  // steam-session numatytai laukia tik 30 s — per mazai, kad zmogus spetu nuskenuoti.
  // Riba privalo buti nustatyta pries startWithQR (po polling pradzios keisti draudziama).
  session.loginTimeout = 5 * 60 * 1000;
  const start = await session.startWithQR();

  log("\nAtidaryk Steam programėlę telefone → Steam Guard → nuskenuok šį QR kodą:\n");
  qrcode.generate(start.qrChallengeUrl, { small: true });

  // Tas pats kodas paveikslelyje — patogu, kai terminalo simboliai atvaizduojami netiksliai
  const qrFile = path.resolve("qr.png");
  await QRCode.toFile(qrFile, start.qrChallengeUrl, { width: 480, margin: 2 });
  log(`QR paveikslėlis: ${qrFile}`);
  log("\n(Kodas galioja kelias minutes. Slaptažodžio vesti nereikia.)\n");

  return new Promise((resolve, reject) => {
    session.on("remoteInteraction", () => log("Nuskenuota — patvirtink prisijungimą telefone…"));
    session.on("authenticated", () => resolve(session.refreshToken));
    session.on("timeout", () => reject(new Error("QR kodas nebegalioja — paleisk programą iš naujo.")));
    session.on("error", (err) => reject(err));
  });
}

function waitFor(emitter, event, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label}: laukimas baigėsi`)), ms);
    emitter.once(event, (...args) => {
      clearTimeout(t);
      resolve(args);
    });
  });
}

function casketContents(csgo, casketId) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Saugyklos turinio laukimas baigėsi")), GC_TIMEOUT_MS);
    csgo.getCasketContents(casketId, (err, items) => {
      clearTimeout(t);
      if (err) reject(err);
      else resolve(items || []);
    });
  });
}

async function main() {
  log("cs2collector.lt — Storage Unit eksportas (tik skaitymas)\n");

  log("Siunčiamas daiktų žemėlapis…");
  const map = await loadMap();

  const refreshToken = await loginWithQr();

  const client = new SteamUser({ autoRelogin: false });
  const csgo = new GlobalOffensive(client);

  client.logOn({ refreshToken });
  await waitFor(client, "loggedOn", 60_000, "Prisijungimas prie Steam");
  const steamId = client.steamID.getSteamID64();
  log(`Prisijungta: ${steamId}`);

  client.gamesPlayed([CS2_APP_ID]);
  log("Jungiamasi prie CS2 žaidimo koordinatoriaus…");
  await waitFor(csgo, "connectedToGC", GC_TIMEOUT_MS, "CS2 koordinatorius");

  const caskets = (csgo.inventory || []).filter((i) => i.def_index === DEF_STORAGE_UNIT);
  if (!caskets.length) log("Saugyklų nerasta.");

  const units = [];
  const unresolved = new Map();
  // Neatpazintu daiktu atributai — kad vertimo klaidas butu galima taisyti be pakartotinio prisijungimo
  const unresolvedSamples = [];

  for (const [idx, c] of caskets.entries()) {
    const name = c.custom_name || `Storage Unit ${idx + 1}`;
    log(`Skaitoma „${name}" (${c.casket_contained_item_count ?? "?"} daiktų)…`);
    const items = await casketContents(csgo, c.id);

    const counts = new Map();
    for (const it of items) {
      const hash = resolveHash(it, map);
      if (!hash) {
        const key = `def ${it.def_index}${it.paint_index != null ? ` / paint ${Math.round(it.paint_index)}` : ""}`;
        unresolved.set(key, (unresolved.get(key) ?? 0) + 1);
        if (unresolvedSamples.length < 20) {
          unresolvedSamples.push({
            def_index: it.def_index,
            paint_index: it.paint_index ?? null,
            quality: it.quality ?? null,
            stickers: it.stickers ?? null,
            attributes: (it.attribute || []).map((a) => ({
              def_index: a.def_index,
              uint32: a.value_bytes?.length >= 4 ? a.value_bytes.readUInt32LE(0) : null,
              float: a.value_bytes?.length >= 4 ? a.value_bytes.readFloatLE(0) : null,
            })),
          });
        }
        continue;
      }
      counts.set(hash, (counts.get(hash) ?? 0) + 1);
    }
    units.push({ name, items: [...counts].map(([hash, count]) => ({ hash, count })) });
  }

  const out = {
    version: 1,
    app: "cs2collector-storage-export",
    exportedAt: new Date().toISOString(),
    steamId,
    units,
    ...(unresolvedSamples.length ? { unresolvedSamples } : {}),
  };

  const file = path.resolve(`cs2collector-saugyklos-${new Date().toISOString().slice(0, 10)}.json`);
  await writeFile(file, JSON.stringify(out, null, 2));

  const total = units.reduce((s, u) => s + u.items.reduce((a, i) => a + i.count, 0), 0);
  log(`\nParuošta: ${units.length} saugyklos, ${total} atpažintų daiktų.`);
  if (unresolved.size) {
    const n = [...unresolved.values()].reduce((a, b) => a + b, 0);
    log(`Neatpažinta: ${n} daiktų (${[...unresolved.keys()].slice(0, 5).join("; ")}${unresolved.size > 5 ? "…" : ""})`);
  }
  log(`\nFailas: ${file}`);
  log("Įkelk jį svetainėje: https://cs2collector.lt/mano\n");

  client.logOff();
  setTimeout(() => process.exit(0), 500);
}

main().catch((e) => {
  console.error(`\nKlaida: ${e.message}`);
  process.exit(1);
});
