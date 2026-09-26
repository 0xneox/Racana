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

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://racana.studio";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "Racana",
  description:
    "Professional book interior typesetting for independent authors.",
  authors: [{ name: "Racana Studio" }],
  openGraph: {
    siteName: "Racana",
    title: "Racana",
    description:
      "Professional book interior typesetting for independent authors.",
    type: "website",
    url: appUrl,
  },
  twitter: {
    card: "summary_large_image",
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
