import type { Metadata } from "next";
import Link from "next/link";
import { OG_IMAGE, SITE, SITE_NAME, SITE_OG_DESCRIPTION, SITE_TITLE } from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description:
    "Sužinok savo CS2 inventoriaus vertę eurais per kelias sekundes. Atnaujinamos Steam Market kainos, skinų katalogas ir kainų istorija — lietuviškai.",
  keywords: ["CS2", "CS:GO", "skinai", "inventoriaus vertė", "Steam Market", "kainos", "Lietuva"],
  openGraph: {
    type: "website",
    locale: "lt_LT",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_OG_DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

// `short` — trumpesnis uzrasas telefono ekranui, kad visos nuorodos tilptu i viena eilute.
const NAV: { href: string; label: string; short?: string }[] = [
  { href: "/", label: "Pradžia" },
  { href: "/kainos", label: "Kainos" },
  { href: "/inventorius", label: "Inventoriaus vertė", short: "Inventorius" },
  { href: "/apie", label: "Apie" },
  { href: "/mano", label: "Mano kolekcija", short: "Kolekcija" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="lt">
      <body className="font-sans antialiased">
        <header className="sticky top-0 z-50 border-b border-ink-700/70 bg-ink-950/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:gap-6">
            <Link href="/" className="group flex items-center gap-2.5 shrink-0">
              <span className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 font-black text-ink-950 shadow-lg shadow-brand-600/20">
                C2
              </span>
              <span className="sr-only text-[15px] font-bold tracking-tight text-white sm:not-sr-only">
                cs2collector<span className="text-brand-500">.lt</span>
              </span>
            </Link>
            {/* Telefone: be uzraso salia logotipo ir be „Pradžia“ (i pradzia veda logotipas), kad tilptu i eilute */}
            <nav className="ml-auto flex min-w-0 items-center gap-1 overflow-x-auto text-[13px] [scrollbar-width:none] sm:text-sm [&::-webkit-scrollbar]:hidden">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`whitespace-nowrap rounded-lg px-2 py-2 text-ink-300 transition-colors hover:bg-ink-800 hover:text-white focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 sm:px-3 ${n.href === "/" ? "max-sm:hidden" : ""}`}
                >
                  {n.short ? (
                    <>
                      <span className="sm:hidden">{n.short}</span>
                      <span className="max-sm:hidden">{n.label}</span>
                    </>
                  ) : (
                    n.label
                  )}
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
