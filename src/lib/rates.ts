import { CURRENCIES, type CurrencyCode, type Rates } from "./currency";

const DAY = 60 * 60 * 24;
const CODES = CURRENCIES.map((c) => c.code).filter((c) => c !== "EUR");

/** Atsarginiai kursai, jei abu saltiniai neveikia (EUR -> valiuta) */
const FALLBACK: Rates = { EUR: 1, USD: 1.12, GBP: 0.86, PLN: 4.27 };

const SOURCES: [string, (j: unknown) => Partial<Record<CurrencyCode, number>> | undefined][] = [
  [`https://api.frankfurter.dev/v1/latest?base=EUR&symbols=${CODES.join(",")}`, (j) => (j as { rates?: Record<CurrencyCode, number> })?.rates],
  [
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.min.json",
    (j) => {
      const r = (j as { eur?: Record<string, number> })?.eur;
      return r && Object.fromEntries(CODES.map((c) => [c, r[c.toLowerCase()]]));
    },
  ],
];

/** Dienos valiutu kursai (ECB per Frankfurter, atsarginis — currency-api). Kesuojama parai. */
export async function loadRates(): Promise<Rates> {
  for (const [url, pick] of SOURCES) {
    try {
      const res = await fetch(url, { next: { revalidate: DAY }, signal: AbortSignal.timeout(8000) });
      const got = pick(await res.json());
      if (got && CODES.every((c) => Number(got[c]) > 0)) {
        return { EUR: 1, ...Object.fromEntries(CODES.map((c) => [c, Number(got[c])])) } as Rates;
      }
    } catch {
      /* bandom kita saltini */
    }
  }
  return FALLBACK;
}
