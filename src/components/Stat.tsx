export function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-850/70 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{label}</p>
      <p
        className={`mt-1.5 text-2xl font-bold tabular-nums ${accent ? "text-brand-400" : "text-white"}`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}
