import type { NextConfig } from "next";

const securityHeaders = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Once a browser has seen the site over HTTPS it will never try plain HTTP
  // again — protects guests on hotel and café wifi.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Nothing may load scripts, styles, images or frames from anywhere we have
  // not named. Next.js hydrates with inline script and style, so those are
  // permitted; the map is the only outside frame; Firebase sign-in and the
  // guest APIs are the only outside connections.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://*.firebaseapp.com",
      // The invitation's typefaces are served by Google Fonts.
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://res.cloudinary.com https://*.googleapis.com https://*.gstatic.com https://maps.google.com",
      "media-src 'self' blob: https://res.cloudinary.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "frame-src https://www.google.com https://maps.google.com https://*.firebaseapp.com https://accounts.google.com",
      "connect-src 'self' https://*.googleapis.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://formspree.io https://api.cloudinary.com",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
