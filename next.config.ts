import type { NextConfig } from "next";

// Saugyklu serveris, i kuri narsykle kreipiasi is ManoPanel.tsx (ta pati numatytoji reiksme).
const STORAGE_ORIGIN = new URL(
  process.env.NEXT_PUBLIC_STORAGE_URL || "https://cs2collector-storage.fly.dev",
).origin;

// 'unsafe-inline' butinas: statiniai (ISR) puslapiai negali tureti nonce, o Next i juos
// iraso inline <script>. 'unsafe-eval' reikia tik React dev rezimui.
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // Prekiu paveiksleliai ir avatarai — Steam CDN; data: — Steam QR kodas is saugyklu serverio.
  "img-src 'self' data: https://*.steamstatic.com",
  `connect-src 'self' ${STORAGE_ORIGIN}`,
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
