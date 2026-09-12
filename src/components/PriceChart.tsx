import { formatEur } from "@/lib/format";

type Point = { date: string; eur: number };

/** Paprastas SVG grafikas be isoriniu biblioteku — greitas ir lengvas */
export function PriceChart({ data }: { data: Point[] }) {
  if (data.length < 2) {
    return (
      <div className="rounded-xl border border-dashed border-ink-700 bg-ink-850/40 p-10 text-center">
        <p className="text-sm text-ink-400">
          Istorija dar kaupiama — grafikas atsiras po kelių dienų stebėjimo.
        </p>
        {data.length === 1 && (
          <p className="mt-1 text-xs text-ink-400">
            Pirmas įrašas: {data[0].date} — {formatEur(data[0].eur)}
          </p>
        )}
      </div>
    );
  }

  const W = 760;
  const H = 200;
  const PAD = 8;
  const values = data.map((d) => d.eur);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || max || 1;

  const x = (i: number) => PAD + (i / (data.length - 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2);

  const line = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.eur).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;
  const last = data[data.length - 1];

  return (
    <div className="rounded-xl border border-ink-700 bg-ink-850/60 p-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-48 w-full"
        role="img"
        aria-label="Kainos istorijos grafikas"
      >
        <defs>
          <linearGradient id="pcFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f5a524" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#f5a524" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#pcFill)" />
        <path
          d={line}
          fill="none"
          stroke="#f5a524"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={x(data.length - 1)} cy={y(last.eur)} r="4" fill="#ffc24d" />
      </svg>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-ink-400">
        <span>
          {data[0].date} · {formatEur(data[0].eur)}
        </span>
        <span>
          Min {formatEur(min)} · Max {formatEur(max)}
        </span>
        <span>
          {last.date} · {formatEur(last.eur)}
        </span>
      </div>
    </div>
  );
}
