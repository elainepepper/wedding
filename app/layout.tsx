import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./editorial-refinement.css";
import "./art-direction.css";

/**
 * There was no viewport declaration at all, which meant env(safe-area-inset-*)
 * resolved to zero everywhere — the padding meant to clear the iPhone home bar
 * did nothing — and Android was free to resize the whole layout when the
 * keyboard appeared. "overlays-content" lets the keyboard sit over the page
 * rather than squeezing it.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "overlays-content",
  themeColor: "#f2e2e2",
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
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
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          as="image"
          href="/wedding/story/bg/dream-1.webp"
          fetchPriority="high"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;1,6..96,400&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Inter:wght@300;400;500;600&family=Montserrat:wght@400;500;600&family=Pinyon+Script&family=Playfair+Display:ital,wght@0,400;0,500;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* the paper-bleed filter behind the two places the couple's names appear as a headline */}
        <svg
          width="0"
          height="0"
          style={{ position: "absolute" }}
          aria-hidden="true"
        >
          <filter id="ink-bleed" x="-6%" y="-6%" width="112%" height="112%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves="2"
              seed="7"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="1.1"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </svg>
        {children}
      </body>
    </html>
  );
}
