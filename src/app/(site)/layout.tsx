import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Poppins, Noto_Sans_Devanagari } from "next/font/google";
import { ThemeProvider } from "next-themes";

const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
  weight: ["400", "500", "600", "700"],
});

const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-devanagari",
  weight: ["400", "500", "600", "700"],
});

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // No <html>/<body> here — the root layout owns those; nesting them produced
  // invalid markup. The font classes go on this wrapper so site pages keep
  // the same Poppins/Devanagari stack they had when it was a <body>.
  return (
    <div className={`${poppins.variable} ${poppins.className} ${devanagari.variable} ${devanagari.className} bg-background text-foreground`}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <Header />
        {children}
        <Footer />
      </ThemeProvider>
    </div>
  );
}
