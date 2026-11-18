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
      "Racana — ₹2,450 · Book Interior Typesetting for English Manuscripts",
    template: "%s — Racana",
  },
  description:
    "Upload an English DOCX or text-based PDF and Racana turns it into a professionally typeset book interior. Classic & Modern styles, cover studio, and EPUB 3 export. ₹2,450 per finished book with free preview.",
  keywords: [
    "book formatting",
    "book typesetting",
    "interior design",
    "print on demand",
    "KDP formatting",
    "IngramSpark formatting",
    "Pothi",
    "self publishing India",
    "English book typesetting",
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
      "Racana — ₹2,450 · Book Interior Typesetting for English Manuscripts",
    description:
      "Upload an English manuscript → Choose a style → Preview your book interior. Cover studio and EPUB 3 export included. Free preview.",
    type: "website",
    url: appUrl,
    locale: "en_IN",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Racana — Book interior typesetting for English-language authors.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title:
      "Racana — ₹2,450 · Book Interior Typesetting & Cover Design for Indian Authors",
    description:
      "Free preview. Classic + Modern styles. English manuscript typesetting.",
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
