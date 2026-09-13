# cs2collector.lt — saugyklų programa

Steam neleidžia svetainėms matyti, kas yra tavo CS2 **Storage Unit** saugyklose. Ši nedidelė
programa nuskaito jas **tavo kompiuteryje** ir pati atidaro
[cs2collector.lt/mano](https://cs2collector.lt/mano), kur saugyklos įsikelia automatiškai.

## Kaip naudotis

1. **Paleisk programą** (žr. „Paleidimas“ žemiau).
2. **Nuskenuok QR kodą** telefone: Steam programėlė → **Steam Guard** → QR skeneris → patvirtink.
   Kodas galioja 5 minutes.
3. **Palauk apie minutę** — programa perskaitys saugyklas ir atidarys svetainę.
   Saugyklų vertė atsiras puslapyje „Mano kolekcija“.

Nieko ieškoti ar įkelti nereikia. Jei naršyklė neatsidarė, programa šalia išsaugo failą
`cs2collector-saugyklos-….json` — jį galima įkelti rankiniu būdu puslapio apačioje.

## Saugumas

- **Slaptažodžio vesti nereikia** — prisijungiama QR kodu per Steam telefono programėlę.
- **Tik skaitymas** — daiktai neperkeliami, neparduodami ir nekeičiami.
- **Duomenys nekeliauja per mūsų serverį.** Saugyklų sąrašas perduodamas adreso dalyje po `#`,
  kurios naršyklė į serverį nesiunčia; svetainė jį išsaugo tik tavo naršyklėje.
- Kodas atviras: `src/index.js`, `src/resolve.js`.

## Paleidimas

Reikia [Node.js](https://nodejs.org) 20 ar naujesnio.

```bash
npm install
npm start
```

## Pastabos

- Kol programa veikia, Steam draugams gali rodyti, kad žaidi CS2 — to reikia prisijungti prie
  žaidimo koordinatoriaus. Baigus programa atsijungia pati.
- Jei tuo metu žaidi CS2 kitame kompiuteryje, žaidimas gali būti atjungtas.
- Retas daiktas gali likti neatpažintas — programa parodo, kiek tokių buvo.
