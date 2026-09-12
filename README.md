# cs2collector.lt

Lietuviškas CS2 skinų kainų ir inventoriaus vertės sekiklis.

- **Kainų katalogas** — Steam Community Market kainos eurais, paieška ir filtrai pagal
  kategoriją, retumą ir kainą.
- **Inventoriaus skaičiuoklė** — įklijuoji Steam profilį, gauni visų skinų vertę eurais,
  pasiskirstymą pagal kategorijas ir brangiausių daiktų sąrašą.
- **Kainų istorija** — kiekvienos dienos momentinė kopija, iš kurios auga grafikas.

## Technologijos

| Sluoksnis | Sprendimas |
| --- | --- |
| Karkasas | Next.js 16 (App Router, React 19) |
| Stilius | Tailwind CSS 4 |
| Duomenys | JSON failai repozitorijoje (`data/`) — jokios duomenų bazės, jokių sąskaitų |
| Kainų šaltinis | Steam Community Market (`/market/search/render`) |
| Inventorius | Steam Community viešieji galiniai taškai |

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
```

Steam grąžina **10 prekių per užklausą**, todėl pilnas katalogas reikalauja ~3 550 užklausų.
Numatytoji tarpuklaida — 2,6 s; keičiama per `SCRAPE_DELAY` (ms).

Rezultatai:

- `data/prices.json` — naujausias rinkinys (naudoja svetainė)
- `data/history/YYYY-MM-DD.json` — dienos momentinė kopija `{ hash: centai }`
- `data/history/index.json` — turimų dienų sąrašas

Automatika: `.github/workflows/kainos.yml` paleidžia surinkimą kasdien 03:20 UTC ir
įrašo pokyčius atgal į repozitoriją. Vercel tai pamato kaip naują commit ir perstato svetainę.

## Aplinkos kintamieji

Žr. `.env.example`. Abu neprivalomi:

- `STEAM_API_KEY` — greitesnis vanity vardų atpažinimas.
- `STEAM_PROXY_URL` — **rekomenduojama gamyboje**. Steam riboja užklausas pagal IP, o
  debesų tiekėjų adresai (įskaitant Vercel) dažnai blokuojami visiškai. Be proxy
  inventoriaus skaičiuoklė gamyboje gali nuolat rodyti „Steam riboja užklausas“.

## Struktūra

```
scripts/scrape-prices.mjs   Steam Market kainų surinkėjas
data/                       kainų momentinės kopijos (versijuojamos git)
src/lib/items.ts            retumai, kategorijos, dėvėjimas, ikonos
src/lib/prices.ts           duomenų įkėlimas, paieška, filtrai
src/lib/steam.ts            profilio ir inventoriaus nuskaitymas
src/app/                    puslapiai (pradžia, kainos, skin, inventorius, apie)
```

## Teisinė pastaba

Projektas nėra susijęs su Valve Corporation. Counter-Strike, CS2 ir Steam yra
Valve Corporation prekių ženklai. Kainos — orientacinės Steam Market vertės.
