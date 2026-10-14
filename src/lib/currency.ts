export const CURRENCIES = [
  { code: "EUR", label: "€ EUR" },
  { code: "USD", label: "$ USD" },
  { code: "GBP", label: "£ GBP" },
  { code: "PLN", label: "zł PLN" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];
/** Kiek valiutos vienetu gaunama uz 1 EUR */
export type Rates = Record<CurrencyCode, number>;

const formatters = new Map<CurrencyCode, Intl.NumberFormat>();

export function formatMoney(eur: number | null | undefined, code: CurrencyCode, rates: Rates): string {
  if (eur == null) return "—";
  let f = formatters.get(code);
  if (!f) {
    f = new Intl.NumberFormat("lt-LT", { style: "currency", currency: code, currencyDisplay: "narrowSymbol" });
    formatters.set(code, f);
  }
  const s = f.format(eur * (rates[code] ?? 1));
  // Dalis narsykliu lt-LT lokaleje zlota rodo kaip "zl"
  return code === "PLN" ? s.replace(/zl$/, "zł") : s;
}
