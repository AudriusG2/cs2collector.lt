#!/usr/bin/env node
/**
 * cs2collector.lt — Storage Unit serveris
 *
 * Parodo QR koda, priima nuskenavima Steam telefono programele ir perskaito
 * vartotojo CS2 saugyklas per zaidimo koordinatoriu. Vartotojui NEREIKIA nieko
 * diegti ar atsisiusti — tik nuskenuoti QR svetaineje.
 *
 * Sauguma:
 *  - Steam prisijungimo raktas (refresh token) laikomas TIK atmintyje ir TIK
 *    tas kelias sekundes, kol skaitomos saugyklos; niekur neirasomas, po darbo
 *    istrinamas;
 *  - sesijos galioja ribota laika ir automatiskai issivalo;
 *  - kreiptis leidziama tik is leidziamu domenu (CORS allowlist);
 *  - tik skaitymas: jokie daiktai neperkeliami, neparduodami, nekeiciami.
 */
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import QRCode from "qrcode";
import { DEF_STORAGE_UNIT, resolveHash } from "./resolve.js";

const require = createRequire(import.meta.url);
const SteamUser = require("steam-user");
const GlobalOffensive = require("globaloffensive");
const { LoginSession, EAuthTokenPlatformType } = require("steam-session");

// Steam bibliotekos gali mesti klaidas asinchroniskai (nutruksta rysys, netiketa bukle).
// Serveris NIEKADA neturi del to nulūžti — viena sesija negali numusti viso proceso.
process.on("uncaughtException", (err) => console.error("uncaughtException:", err?.message || err));
process.on("unhandledRejection", (err) => console.error("unhandledRejection:", err?.message || err));

const PORT = Number(process.env.PORT ?? 8787);
const MAP_URL = process.env.CS2C_MAP_URL ?? "https://cs2collector.lt/item-map.json";
const CS2_APP_ID = 730;
const GC_TIMEOUT_MS = 90_000;
const SESSION_TTL_MS = 6 * 60 * 1000; // sesija gyvuoja ne ilgiau nei 6 min
const MAX_ACTIVE = Number(process.env.MAX_ACTIVE ?? 20);

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "https://cs2collector.lt,https://www.cs2collector.lt")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/* ------------------------------------------------------------------ */
/* Daiktu zemelapis (def_index -> market_hash_name)                    */
/* ------------------------------------------------------------------ */
let itemMap = null;
let itemMapAt = 0;
async function getItemMap() {
  if (itemMap && Date.now() - itemMapAt < 6 * 60 * 60 * 1000) return itemMap;
  const res = await fetch(MAP_URL, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Nepavyko gauti daiktų žemėlapio (${res.status})`);
  itemMap = await res.json();
  itemMapAt = Date.now();
  return itemMap;
}

/* ------------------------------------------------------------------ */
/* Sesijos                                                             */
/* ------------------------------------------------------------------ */
/**
 * state: qr → confirming → reading → done | error | expired
 * Reiksmingi laukai atiduodami narsyklei; refreshToken NIEKADA neatiduodamas.
 */
const sessions = new Map();

function publicView(s) {
  return {
    state: s.state,
    qrPng: s.state === "qr" || s.state === "confirming" ? s.qrPng : undefined,
    steamId: s.steamId ?? undefined,
    units: s.units ?? undefined,
    unresolvedCount: s.unresolvedCount || undefined,
    error: s.error ?? undefined,
  };
}

function destroySession(id) {
  const s = sessions.get(id);
  if (!s) return;
  try {
    s.login?.cancelLoginAttempt?.();
  } catch {
    /* nieko */
  }
  try {
    s.client?.logOff?.();
  } catch {
    /* nieko */
  }
  s.refreshToken = null; // aiskus rakto istrynimas
  sessions.delete(id);
}

// Periodinis pasenusiu sesiju valymas
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) if (now > s.expiresAt) destroySession(id);
}, 30_000).unref();

async function readCaskets(refreshToken, session) {
  const map = await getItemMap();
  const client = new SteamUser({ autoRelogin: false });
  const csgo = new GlobalOffensive(client);
  session.client = client;

  const waitFor = (emitter, event, ms, label) =>
    new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`${label}: laukimas baigėsi`)), ms);
      emitter.once(event, (...a) => {
        clearTimeout(t);
        resolve(a);
      });
    });

  client.logOn({ refreshToken });
  await waitFor(client, "loggedOn", 60_000, "Steam");
  session.steamId = client.steamID.getSteamID64();

  client.gamesPlayed([CS2_APP_ID]);
  await waitFor(csgo, "connectedToGC", GC_TIMEOUT_MS, "CS2 koordinatorius");

  const caskets = (csgo.inventory || []).filter((i) => i.def_index === DEF_STORAGE_UNIT);
  const units = [];
  let unresolved = 0;

  for (const [idx, c] of caskets.entries()) {
    const items = await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("Saugyklos laukimas baigėsi")), GC_TIMEOUT_MS);
      csgo.getCasketContents(c.id, (err, list) => {
        clearTimeout(t);
        if (err) reject(err);
        else resolve(list || []);
      });
    });
    const counts = new Map();
    for (const it of items) {
      const hash = resolveHash(it, map);
      if (!hash) {
        unresolved += 1;
        continue;
      }
      counts.set(hash, (counts.get(hash) ?? 0) + 1);
    }
    units.push({
      name: c.custom_name || `Storage Unit ${idx + 1}`,
      items: [...counts].map(([hash, count]) => ({ hash, count })),
    });
  }

  client.logOff();
  session.client = null;
  return { units, unresolved };
}

async function startSession(session) {
  const login = new LoginSession(EAuthTokenPlatformType.SteamClient);
  login.loginTimeout = 5 * 60 * 1000;
  session.login = login;

  const start = await login.startWithQR();
  session.qrPng = await QRCode.toDataURL(start.qrChallengeUrl, { width: 320, margin: 2 });
  session.state = "qr";

  login.on("remoteInteraction", () => {
    if (session.state === "qr") session.state = "confirming";
  });

  login.on("authenticated", async () => {
    const refreshToken = login.refreshToken;
    session.login = null;
    session.state = "reading";
    try {
      const { units, unresolved } = await readCaskets(refreshToken, session);
      session.units = units;
      session.unresolvedCount = unresolved;
      session.state = "done";
    } catch (err) {
      session.state = "error";
      session.error = err?.message || "Nepavyko perskaityti saugyklų";
    } finally {
      session.refreshToken = null; // raktas sunaikinamas bet kuriuo atveju
      // Baigtos sesijos rezultatas dar palaikomas trumpai, kad narsykle spetu paimti
      session.expiresAt = Math.min(session.expiresAt, Date.now() + 60_000);
    }
  });

  login.on("timeout", () => {
    if (session.state === "qr" || session.state === "confirming") {
      session.state = "expired";
      session.error = "QR kodas nebegalioja — pradėk iš naujo";
    }
  });

  login.on("error", (err) => {
    session.state = "error";
    session.error = err?.message || "Steam prisijungimo klaida";
  });
}

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */
function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && (ALLOWED_ORIGINS.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

const json = (res, code, body) => {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
};

const server = createServer(async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") return res.writeHead(204).end();

  const url = new URL(req.url, "http://x");

  if (req.method === "GET" && url.pathname === "/health") {
    return json(res, 200, { ok: true, active: sessions.size });
  }

  if (req.method === "POST" && url.pathname === "/api/storage/start") {
    // Isvalom pasenusias, kad MAX_ACTIVE riba butu teisinga
    const now = Date.now();
    for (const [id, s] of sessions) if (now > s.expiresAt) destroySession(id);
    if (sessions.size >= MAX_ACTIVE) return json(res, 503, { error: "Serveris užimtas, pabandyk po minutės" });

    const id = randomUUID();
    const session = { id, state: "starting", expiresAt: Date.now() + SESSION_TTL_MS };
    sessions.set(id, session);
    try {
      await startSession(session);
    } catch (err) {
      destroySession(id);
      return json(res, 502, { error: err?.message || "Nepavyko pradėti prisijungimo" });
    }
    return json(res, 200, { id, ...publicView(session) });
  }

  const m = url.pathname.match(/^\/api\/storage\/([0-9a-f-]{36})$/);
  if (req.method === "GET" && m) {
    const s = sessions.get(m[1]);
    if (!s) return json(res, 404, { state: "expired", error: "Sesija nebegalioja" });
    return json(res, 200, publicView(s));
  }

  if (req.method === "POST" && m) {
    // Narsykle gali paprasyti pamirsti sesija (pvz. uzdarant langa)
    destroySession(m[1]);
    return json(res, 200, { ok: true });
  }

  json(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`cs2collector saugyklų serveris klauso :${PORT}`);
  console.log(`Leidžiami domenai: ${ALLOWED_ORIGINS.join(", ")} (+ localhost)`);
});
