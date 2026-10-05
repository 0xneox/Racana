import type { Metadata } from "next";
import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://racana.pro";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default:
      "Racana — ₹2,450 · Professional Book Interior Typesetting & Cover Design for Indian Authors",
    template: "%s — Racana",
  },
  description:
    "Upload your DOCX or PDF manuscript and Racana turns it into a professionally typeset, print-ready book interior in minutes. Classic & Modern styles, interactive cover studio with classical motifs, EPUB 3 export, and native Devanagari, Tamil & Malayalam rendering. ₹2,450 per finished book with free preview.",
  keywords: [
    "book formatting",
    "book typesetting",
    "interior design",
    "print on demand",
    "KDP formatting",
    "IngramSpark formatting",
    "Pothi",
    "self publishing India",
    "Malayalam book typesetting",
    "Tamil book formatting",
    "Devanagari typesetting",
    "Hindi book layout",
    "DOCX to PDF book",
    "EPUB conversion India",
    "book cover designer",
    "interior typesetter cost",
  ],
  authors: [{ name: "Racana Studio", url: appUrl }],
  creator: "Racana Studio",
  publisher: "Racana Studio",
  category: "Design Application",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    siteName: "Racana",
    title:
      "Racana — ₹2,450 · Professional Book Interior Typesetting & Cover Design for Indian Authors",
    description:
      "Upload DOCX → Choose Style → Get a print-ready interior in minutes. Indian-script native rendering, cover studio + EPUB included. Free preview.",
    type: "website",
    url: appUrl,
    locale: "en_IN",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Racana — Book interior publisher for Indian authors. Upload your manuscript. Get a finished book.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title:
      "Racana — ₹2,450 · Book Interior Typesetting & Cover Design for Indian Authors",
    description:
      "Free preview. Classic + Modern styles. Devanagari, Tamil & Malayalam supported.",
    images: ["/opengraph-image"],
    creator: "@racana_studio",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icon-512.png", sizes: "512x512", type: "image/png" }],
  },
  applicationName: "Racana",
  appleWebApp: { capable: true, title: "Racana", statusBarStyle: "default" },
  formatDetection: { email: false, address: false, telephone: false },
  verification: {
    // Drop Google/other verification tokens in here via env later:
    // google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION,
  },
};

const umamiSrc = process.env.NEXT_PUBLIC_UMAMI_SRC;
const umamiWebsiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`h-full ${playfair.variable} ${jakarta.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Indic script fonts for the animated multilingual brand logo.
            Google Fonts serves these with unicode-range subsetting, so the
            browser only downloads font files for scripts actually rendered
            on the page — no performance cost until the animation needs them. */}
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+Devanagari:wght@400;700&family=Noto+Serif+Malayalam:wght@400;700&family=Noto+Serif+Tamil:wght@400;700&family=Noto+Serif+Bengali:wght@400;700&family=Noto+Serif+Gujarati:wght@400;700&family=Noto+Serif+Kannada:wght@400;700&family=Noto+Serif+Telugu:wght@400;700&family=Noto+Serif+Gurmukhi:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full font-sans antialiased">
        {umamiSrc && umamiWebsiteId && (
          <script
            defer
            src={umamiSrc}
            data-website-id={umamiWebsiteId}
          />
        )}
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
