const eur = new Intl.NumberFormat("lt-LT", { style: "currency", currency: "EUR" });
const eurCompact = new Intl.NumberFormat("lt-LT", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
});
const num = new Intl.NumberFormat("lt-LT");

export const formatEur = (v: number | null | undefined) => (v == null ? "—" : eur.format(v));
export const formatEurCompact = (v: number) => (v >= 10_000 ? eurCompact.format(v) : eur.format(v));
export const formatNum = (v: number) => num.format(v);

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 0) return "ką tik";
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "ką tik";
  if (m < 60) return `prieš ${m} min.`;
  const h = Math.floor(m / 60);
  if (h < 24) return `prieš ${h} val.`;
  const d = Math.floor(h / 24);
  return `prieš ${d} d.`;
}
