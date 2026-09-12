# cs2collector.lt

Lietuviškas CS2 skinų kainų ir inventoriaus vertės sekiklis.

- **Kainų katalogas** — Steam Community Market kainos eurais, paieška ir filtrai pagal
  kategoriją, retumą ir kainą.
- **Inventoriaus skaičiuoklė** — įklijuoji Steam profilį, gauni visų skinų vertę eurais,
  pasiskirstymą pagal kategorijas ir brangiausių daiktų sąrašą.
- **Kainų istorija** — kiekvienos dienos momentinė kopija, iš kurios auga grafikas.
- **Mano kolekcija** (`/mano`) — prisijungimas per Steam, visos kolekcijos vertė su
  Storage Unit saugyklomis ir vertės istorija.

## Technologijos

| Sluoksnis | Sprendimas |
| --- | --- |
| Karkasas | Next.js 16 (App Router, React 19) |
| Stilius | Tailwind CSS 4 |
| Duomenys | JSON failai repozitorijoje (`data/`) — jokios duomenų bazės |
| Kainų šaltinis | Steam Community Market (`/market/search/render`) |
| Inventorius | Steam Community viešieji galiniai taškai per Cloudflare Worker proxy |
| Prisijungimas | Steam OpenID 2.0 + HMAC pasirašytas slapukas (be DB) |
| Hostingas | Vercel (diegiama automatiškai iš `main`) |

## Paleidimas

```bash
npm install
node scripts/scrape-prices.mjs --pages 400   # surenka ~4000 populiariausių prekių
npm run dev
```

Atsidaro http://localhost:3000

## Duomenų surinkimas

```bash
node scripts/scrape-prices.mjs              # ~4000 populiariausių (numatyta)
node scripts/scrape-prices.mjs --pages 100  # greitesnis bandymas
node scripts/scrape-prices.mjs --all        # visas katalogas (~35 000, ~2,5 val.)
node scripts/build-item-map.mjs             # public/item-map.json saugyklų programai
```

Steam grąžina **10 prekių per užklausą**, todėl pilnas katalogas reikalauja ~3 550 užklausų.
Numatytoji tarpuklaida — 2,6 s; keičiama per `SCRAPE_DELAY` (ms).

Rezultatai:

- `data/prices.json` — naujausias rinkinys (naudoja svetainė)
- `data/history/YYYY-MM-DD.json` — dienos momentinė kopija `{ hash: centai }`
- `data/history/index.json` — turimų dienų sąrašas
- `public/item-map.json` — žaidimo koordinatoriaus duomenų vertimas į Market pavadinimus
  (šaltinis — [ByMykel/CSGO-API](https://github.com/ByMykel/CSGO-API))

Automatika: `.github/workflows/kainos.yml` paleidžia surinkimą kasdien 03:20 UTC ir
įrašo pokyčius atgal į repozitoriją. Vercel tai pamato kaip naują commit ir perstato svetainę.

## Aplinkos kintamieji

Žr. `.env.example`.

| Kintamasis | Kam | Gamyboje |
| --- | --- | --- |
| `STEAM_PROXY_URL` | Proxy Steam užklausoms (`proxy/` Cloudflare Worker) | **būtina** |
| `STEAM_PROXY_HTTP` | Alternatyva — įprastas HTTP proxy | vietoj ankstesnio |
| `SESSION_SECRET` | Prisijungimo slapuko parašas, ≥ 32 simboliai | **būtina** |
| `SITE_URL` | OpenID grįžimo adresas, `https://cs2collector.lt` | **būtina** |
| `STEAM_API_KEY` | Greitesnis vanity vardų atpažinimas | neprivaloma |

Steam blokuoja debesų tiekėjų IP (įskaitant Vercel), todėl be proxy inventoriaus
skaičiuoklė gamyboje rodo „Steam riboja užklausas“. Cloudflare Steam neblokuoja.
Be `SESSION_SECRET` prisijungimas sąmoningai neveikia, o likusi svetainė veikia.

## Prisijungimas ir saugyklos

- **Prisijungimas** vyksta oficialiame `steamcommunity.com` puslapyje (OpenID). Svetainė
  slaptažodžio negauna — tik Steam patvirtintą SteamID. Parašą tikrina pats Steam
  (`check_authentication`), papildomai tikrinami `return_to`, `op_endpoint`, `claimed_id`
  ir nonce senumas.
- **Storage Unit turinio** Steam viešai neatiduoda, todėl jį nuskaito programa vartotojo
  kompiuteryje — [`tools/storage-export`](tools/storage-export) (QR prisijungimas, tik
  skaitymas). Gautas `.json` įkeliamas `/mano` puslapyje ir įkainojamas per `/api/ikainoti`.

## Struktūra

```
scripts/scrape-prices.mjs     Steam Market kainų surinkėjas
scripts/build-item-map.mjs    item-map.json generatorius
data/                         kainų momentinės kopijos (versijuojamos git)
proxy/                        Cloudflare Worker — Steam užklausų proxy
tools/storage-export/         Storage Unit eksporto programa (veikia vartotojo PC)
src/lib/items.ts              retumai, kategorijos, dėvėjimas, ikonos
src/lib/prices.ts             duomenų įkėlimas, paieška, filtrai
src/lib/fetcher.ts            proxy sluoksnis Steam užklausoms
src/lib/steam.ts              profilio ir inventoriaus nuskaitymas
src/lib/openid.ts             Steam OpenID prisijungimas
src/lib/session.ts            pasirašytas sesijos slapukas
src/app/                      puslapiai ir API maršrutai
```

## Teisinė pastaba

Projektas nėra susijęs su Valve Corporation. Counter-Strike, CS2 ir Steam yra
Valve Corporation prekių ženklai. Kainos — orientacinės Steam Market vertės.
