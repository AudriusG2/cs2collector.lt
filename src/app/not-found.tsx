import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <p className="text-6xl font-black text-brand-500">404</p>
      <h1 className="mt-4 text-2xl font-bold text-white">Puslapis nerastas</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-400">
        Tokios prekės ar puslapio nėra. Gal ieškai kainų katalogo?
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Link
          href="/"
          className="rounded-xl bg-gradient-to-b from-brand-400 to-brand-600 px-5 py-2.5 text-sm font-semibold text-ink-950 transition-all hover:brightness-110"
        >
          Į pradžią
        </Link>
        <Link
          href="/kainos"
          className="rounded-xl border border-ink-700 px-5 py-2.5 text-sm font-medium text-ink-200 transition-colors hover:border-ink-600 hover:text-white"
        >
          Kainų katalogas
        </Link>
      </div>
    </div>
  );
}
