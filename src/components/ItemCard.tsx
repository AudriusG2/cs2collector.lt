import Link from "next/link";
import { formatEur, formatNum } from "@/lib/format";
import { wearShort } from "@/lib/items";
import type { Item } from "@/lib/types";

export function ItemCard({ item }: { item: Item }) {
  const wear = wearShort(item.wear);
  return (
    <Link
      href={`/skin/${encodeURIComponent(item.h)}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-ink-700 bg-ink-850 transition-all hover:-translate-y-0.5 hover:border-ink-600 hover:shadow-xl hover:shadow-black/40"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-0.5"
        style={{ background: item.rarity.color }}
      />
      <div
        className="relative grid h-28 place-items-center p-3"
        style={{ background: `radial-gradient(circle at 50% 55%, ${item.rarity.color}26, transparent 70%)` }}
      >
        {item.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.icon}
            alt=""
            loading="lazy"
            className="max-h-full w-auto object-contain drop-shadow transition-transform group-hover:scale-105"
          />
        ) : (
          <span className="text-3xl opacity-30">🎯</span>
        )}
        {item.statTrak && (
          <span className="absolute left-2 top-2 rounded bg-[#cf6a32]/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
            ST
          </span>
        )}
        {wear && (
          <span className="absolute right-2 top-2 rounded bg-ink-950/80 px-1.5 py-0.5 text-[10px] font-semibold text-ink-300">
            {wear}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 border-t border-ink-700/70 p-3">
        <p className="line-clamp-2 text-[13px] font-medium leading-snug text-ink-200 group-hover:text-white">
          {item.n}
        </p>
        <div className="mt-auto flex items-end justify-between pt-2">
          <span className="text-[15px] font-bold text-brand-400">{formatEur(item.eur)}</span>
          <span className="text-[11px] text-ink-400">{formatNum(item.l)} skelb.</span>
        </div>
      </div>
    </Link>
  );
}
