import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Manuscript In, Book Out — Zero-Technical Interior Book Typesetting",
  description:
    "Upload your manuscript. Choose a style. We make the book. Instant, print-ready bookstore quality PDF interiors without margin or gutter math.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="flex flex-col min-h-full font-sans antialiased selection:bg-[#EFE8DE] selection:text-[#1C1917]">
        <Header />
        <main className="flex-grow">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
