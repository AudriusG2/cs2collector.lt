import { formatNum } from "@/lib/format";
import type { StorageUnit } from "@/lib/types";

/**
 * Steam viesai neatiduoda Storage Unit turinio — matomas tik daiktu kiekis.
 * Todel apie juos praneseme atskirai, kad bendra suma neatrodytu klaidingai maza.
 */
export function StorageUnits({ units, storedCount }: { units: StorageUnit[]; storedCount: number }) {
  if (!units.length) return null;

  return (
    <section className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-5">
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-lg">
          📦
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-white">
            Saugyklose paslėpta {formatNum(storedCount)} daiktų — jie neįskaičiuoti
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-300">
            Steam viešai neatiduoda Storage Unit turinio — matomas tik daiktų kiekis. Ką tiksliai
            laikai viduje, mato tik pats Steam, prisijungęs prie tavo paskyros. Tikroji inventoriaus
            vertė todėl yra <b className="text-amber-300">didesnė</b> nei rodoma aukščiau.
          </p>

          <ul className="mt-3 flex flex-col gap-1.5">
            {units.map((u) => (
              <li key={u.hash} className="flex items-center gap-2.5 text-sm">
                {u.icon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.icon} alt="" loading="lazy" className="size-7 shrink-0 object-contain" />
                )}
                <span className="text-ink-200">{u.name}</span>
                <span className="ml-auto tabular-nums text-ink-400">
                  {formatNum(u.storedCount)} daiktų
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-xs leading-relaxed text-ink-400">
            Nori pamatyti ir juos? Žaidime išimk daiktus iš saugyklos į inventorių ir perkrauk šį
            puslapį. Slaptažodžio niekada neprašome ir prisijungimo nereikalaujame.
          </p>
        </div>
      </div>
    </section>
  );
}
