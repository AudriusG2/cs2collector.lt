# Steam proxy (Cloudflare Worker)

Steam blokuoja debesų tiekėjų IP adresus, todėl `cs2collector.lt` inventoriaus
skaičiuoklė iš Vercel užklausų atlikti negali. Šis Worker perduoda jas per
Cloudflare tinklą.

## Paleidimas

```bash
npx wrangler login
npx wrangler secret put PROXY_SECRET   # ilga atsitiktinė eilutė
npx wrangler deploy
```

Tada Vercel projekto nustatymuose įrašyk:

```
STEAM_PROXY_URL = https://cs2collector-steam-proxy.<paskyra>.workers.dev/<PROXY_SECRET>
```

## Apsaugos

- Be teisingo `PROXY_SECRET` grąžinama 404 — kad netaptų atviru proxy.
- Leidžiami tik Steam domenai (`steamcommunity.com`, `api.steampowered.com`,
  `store.steampowered.com`).
- Leidžiamas tik `GET`.

Nemokamo plano riba — 100 000 užklausų per parą, to su kaupu pakanka.
