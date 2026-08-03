import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${protocol}://${host}` : "http://localhost:3000";
  const description =
    "A wedding celebration at Grand Hyatt Kuala Lumpur on 7 November 2026.";

  return {
    title: {
      default: "Elaine & Haykal",
      template: "%s · Elaine & Haykal",
    },
    description,
    // Locked privacy spec: the invitation is shared by private link only —
    // never indexed, and guest tokens never leak through the Referer header.
    robots: { index: false, follow: false },
    referrer: "no-referrer",
    openGraph: {
      title: "Elaine & Haykal — 7 November 2026",
      description,
      type: "website",
      images: [{ url: `${origin}/og-wedding.png`, width: 1536, height: 1024 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Elaine & Haykal — 7 November 2026",
      description,
      images: [`${origin}/og-wedding.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preload" as="image" href="/wedding/hero-portrait-small.webp" media="(max-width: 640px)" />
        <link rel="preload" as="image" href="/wedding/story/gen-floral-arch-with-blue-lace-accents.webp" fetchPriority="high" />
        <link rel="preload" as="image" href="/wedding/story/gen-whimsical-canopy-wedding-sticker.webp" fetchPriority="high" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Montserrat:wght@400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
