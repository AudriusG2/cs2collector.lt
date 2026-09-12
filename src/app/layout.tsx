import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

const SITE = "https://cs2collector.lt";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "CS2 Collector — CS2 skinų kainos ir inventoriaus vertė",
    template: "%s · CS2 Collector",
  },
  description:
    "Sužinok savo CS2 inventoriaus vertę eurais per kelias sekundes. Atnaujinamos Steam Market kainos, skinų katalogas ir kainų istorija — lietuviškai.",
  keywords: ["CS2", "CS:GO", "skinai", "inventoriaus vertė", "Steam Market", "kainos", "Lietuva"],
  openGraph: {
    type: "website",
    locale: "lt_LT",
    url: SITE,
    siteName: "CS2 Collector",
    title: "CS2 Collector — CS2 skinų kainos ir inventoriaus vertė",
    description: "Patikrink savo CS2 inventoriaus vertę eurais. Steam Market kainos lietuviškai.",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

const NAV = [
  { href: "/", label: "Pradžia" },
  { href: "/kainos", label: "Kainos" },
  { href: "/inventorius", label: "Inventoriaus vertė" },
  { href: "/apie", label: "Apie" },
  { href: "/mano", label: "Mano kolekcija" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="lt">
      <body className="font-sans antialiased">
        <header className="sticky top-0 z-50 border-b border-ink-700/70 bg-ink-950/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
            <Link href="/" className="group flex items-center gap-2.5 shrink-0">
              <span className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 font-black text-ink-950 shadow-lg shadow-brand-600/20">
                C2
              </span>
              <span className="text-[15px] font-bold tracking-tight text-white">
                cs2collector<span className="text-brand-500">.lt</span>
              </span>
            </Link>
            <nav className="ml-auto flex items-center gap-1 text-sm">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="rounded-lg px-3 py-2 text-ink-300 transition-colors hover:bg-ink-800 hover:text-white"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>

        <footer className="mt-20 border-t border-ink-700/70 bg-ink-950/60">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-ink-400 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {new Date().getFullYear()} cs2collector.lt — kainos iš Steam Community Market.
            </p>
            <p className="text-xs">
              Nesusiję su Valve Corporation. Counter-Strike ir CS2 yra Valve prekių ženklai.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
