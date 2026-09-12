# cs2collector.lt — Storage Unit eksportas

Steam viešai neatiduoda CS2 saugyklų (Storage Unit) turinio, todėl jokia svetainė jo
nemato. Ši programa veikia **tavo kompiuteryje**, nuskaito saugyklas ir sukuria `.json`
failą, kurį įkeli puslapyje [cs2collector.lt/mano](https://cs2collector.lt/mano).

## Saugumas

- **Slaptažodžio vesti nereikia.** Prisijungiama QR kodu per Steam telefono programėlę.
- **Tik skaitymas.** Programa daiktų neperkelia, neparduoda ir nekeičia.
- **Niekas nesiunčiama į cs2collector.lt.** Parsisiunčiamas tik viešas daiktų žemėlapis;
  failą į svetainę įkeli pats.
- Kodas atviras — jį galima perskaityti: `src/index.js`.

## Paleidimas

Reikia [Node.js](https://nodejs.org) 20 ar naujesnio.

```bash
npm install
npm start
```

1. Terminale atsiras QR kodas.
2. Telefone: **Steam → Steam Guard → nuskenuoti QR** ir patvirtinti.
3. Palauk, kol nuskaitys saugyklas.
4. Šalia atsiras failas `cs2collector-saugyklos-YYYY-MM-DD.json` — įkelk jį svetainėje.

## Pastabos

- Kol programa veikia, Steam draugams gali rodyti, kad žaidi CS2 — tai būtina, norint
  prisijungti prie žaidimo koordinatoriaus. Baigus programa atsijungia pati.
- Jei tuo metu žaidi CS2 kitame kompiuteryje, žaidimas gali būti atjungtas.
- Retas daiktas gali likti neatpažintas — programa parodo, kiek tokių buvo.
