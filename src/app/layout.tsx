import type { Metadata } from "next";
import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`h-full ${playfair.variable} ${jakarta.variable}`}
    >
      <body className="min-h-full font-sans antialiased">
        {umamiSrc && umamiWebsiteId && (
          <script
            defer
            src={umamiSrc}
            data-website-id={umamiWebsiteId}
          />
        )}
        {children}
      </body>
    </html>
  );
}
