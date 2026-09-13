# cs2collector.lt — saugyklų serveris

Nuskaito CS2 **Storage Unit** saugyklas per QR prisijungimą, kad vartotojui
nereikėtų nieko diegti: jis tik nuskenuoja QR kodą svetainėje.

## Kaip veikia

1. Naršyklė kreipiasi `POST /api/storage/start` → serveris pradeda Steam QR
   prisijungimą ir grąžina QR kodą (PNG).
2. Vartotojas nuskenuoja QR Steam telefono programėle ir patvirtina.
3. Serveris gauna prisijungimo raktą, prisijungia prie CS2 žaidimo
   koordinatoriaus, perskaito saugyklas ir grąžina jų sąrašą.
4. Naršyklė periodiškai tikrina `GET /api/storage/:id`, kol būsena tampa `done`.

## Sauguma

- **Steam prisijungimo raktas laikomas tik atmintyje** ir tik tas kelias
  sekundes, kol skaitomos saugyklos. Niekur neįrašomas, po darbo ištrinamas.
- Naršyklei atiduodamas tik saugyklų sąrašas — niekada raktas.
- Sesijos galioja ribotą laiką ir automatiškai išsivalo.
- Kreiptis leidžiama tik iš `ALLOWED_ORIGINS` domenų.
- Tik skaitymas: daiktai neperkeliami, neparduodami, nekeičiami.

## Paleidimas

```bash
npm install
npm start
```

## Aplinkos kintamieji

| Kintamasis | Numatyta | Aprašymas |
| --- | --- | --- |
| `PORT` | `8787` | Klausymo prievadas |
| `ALLOWED_ORIGINS` | `https://cs2collector.lt,https://www.cs2collector.lt` | Leidžiami domenai (kableliais) |
| `MAX_ACTIVE` | `20` | Daugiausia vienu metu aktyvių sesijų |
| `CS2C_MAP_URL` | `https://cs2collector.lt/item-map.json` | Daiktų žemėlapio adresas |

## Talpinimas

Reikia nuolat veikiančio proceso su HTTPS (naršyklė iš `https://` negali
kreiptis į `http://`). Rekomenduojama: atskiras pilnas domenas
(pvz. `storage.cs2collector.lt`) su automatiniu TLS (Caddy) prieš šį servisą.
Svetainės pusėje nustatyk `NEXT_PUBLIC_STORAGE_URL=https://storage.cs2collector.lt`.
