import type { Metadata } from "next";

export const SITE = "https://cs2collector.lt";
export const SITE_NAME = "CS2 Collector";
export const SITE_TITLE = "CS2 Collector — CS2 skinų kainos ir inventoriaus vertė";
export const SITE_OG_DESCRIPTION =
  "Patikrink savo CS2 inventoriaus vertę eurais. Steam Market kainos lietuviškai.";
/** Dalinimosi (Open Graph) paveikslelis puslapiams, kurie neturi savo — public/og.png */
export const OG_IMAGE = { url: "/og.png", width: 1200, height: 630 };

type PageSeo = {
  /** Kelias nuo saknies, pvz. "/kainos" — pilna adresa sudeda metadataBase */
  path: string;
  title?: string;
  description?: string;
  image?: string;
};

/**
 * Canonical ir Open Graph vienam puslapiui. Puslapio `openGraph` layout'o objekto
 * nepapildo, o perraso visa, todel bendri laukai (tipas, kalba, pavadinimas) kartojami cia.
 */
export function pageSeo({
  path,
  title = SITE_TITLE,
  description = SITE_OG_DESCRIPTION,
  image,
}: PageSeo): Pick<Metadata, "alternates" | "openGraph"> {
  return {
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "lt_LT",
      siteName: SITE_NAME,
      url: path,
      title,
      description,
      images: [image ? { url: image } : OG_IMAGE],
    },
  };
}

/** JSON-LD <script> turinys; "<" pakeiciamas, kad pavadinimas negaletu uzdaryti zymos. */
export const jsonLdHtml = (data: object) => ({ __html: JSON.stringify(data).replace(/</g, "\\u003c") });
