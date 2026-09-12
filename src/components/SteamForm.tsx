"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SteamForm({ size = "lg", initial = "" }: { size?: "lg" | "sm"; initial?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    setBusy(true);
    router.push(`/inventorius/${encodeURIComponent(v)}`);
  }

  const big = size === "lg";

  return (
    <form onSubmit={submit} className="w-full">
      <div
        className={`flex flex-col gap-2 rounded-2xl border border-ink-700 bg-ink-850/80 p-2 shadow-2xl shadow-black/40 backdrop-blur sm:flex-row ${big ? "" : "max-w-xl"}`}
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="steamcommunity.com/id/tavo_vardas arba SteamID64"
          aria-label="Steam profilio nuoroda arba SteamID"
          autoComplete="off"
          spellCheck={false}
          className={`min-w-0 flex-1 rounded-xl bg-transparent px-4 text-ink-200 outline-none placeholder:text-ink-400 ${big ? "py-3.5 text-[15px]" : "py-2.5 text-sm"}`}
        />
        <button
          type="submit"
          disabled={busy || !value.trim()}
          className={`shrink-0 rounded-xl bg-gradient-to-b from-brand-400 to-brand-600 font-semibold text-ink-950 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 ${big ? "px-7 py-3.5 text-[15px]" : "px-5 py-2.5 text-sm"}`}
        >
          {busy ? "Skaičiuoju…" : "Skaičiuoti vertę"}
        </button>
      </div>
    </form>
  );
}
