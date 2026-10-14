"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { CURRENCIES, type CurrencyCode, type Rates, formatMoney } from "@/lib/currency";

const STORAGE_KEY = "cs2c_currency";

type Ctx = { code: CurrencyCode; rates: Rates; setCode: (c: CurrencyCode) => void };
const CurrencyContext = createContext<Ctx>({ code: "EUR", rates: { EUR: 1, USD: 1, GBP: 1, PLN: 1 }, setCode: () => {} });

export function CurrencyProvider({ rates, children }: { rates: Rates; children: React.ReactNode }) {
  // Serveris visada piesia eurais; issaugota valiuta pritaikoma tik narsykleje po ikelimo.
  const [code, setCodeState] = useState<CurrencyCode>("EUR");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as CurrencyCode | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage pasiekiamas tik po hidratacijos
      if (saved && CURRENCIES.some((c) => c.code === saved)) setCodeState(saved);
    } catch {
      /* privatus rezimas — liekam EUR */
    }
  }, []);

  const setCode = (c: CurrencyCode) => {
    setCodeState(c);
    try {
      localStorage.setItem(STORAGE_KEY, c);
    } catch {
      /* nieko */
    }
  };

  return <CurrencyContext.Provider value={{ code, rates, setCode }}>{children}</CurrencyContext.Provider>;
}

/** Kaina pasirinkta valiuta; `eur` — suma eurais */
export function Money({ eur }: { eur: number | null | undefined }) {
  const { code, rates } = useContext(CurrencyContext);
  return <>{formatMoney(eur, code, rates)}</>;
}

export function CurrencySelect({ className = "" }: { className?: string }) {
  const { code, setCode } = useContext(CurrencyContext);
  return (
    <select
      value={code}
      onChange={(e) => setCode(e.target.value as CurrencyCode)}
      aria-label="Valiuta"
      className={`rounded-lg border border-ink-700 bg-ink-850 px-2 py-1.5 text-xs text-ink-200 outline-none focus:border-brand-600 ${className}`}
    >
      {CURRENCIES.map((c) => (
        <option key={c.code} value={c.code}>
          {c.label}
        </option>
      ))}
    </select>
  );
}
