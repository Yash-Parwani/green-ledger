import type { Metadata } from "next";
import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { SiteNav } from "@/components/ui/SiteNav";
import { SiteFooter } from "@/components/ui/SiteFooter";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  style: ["normal", "italic"],
  axes: ["opsz", "SOFT"],
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "GreenLedger — Swiggy Builders Club",
  description:
    "Deploy a corporate CSR budget without the spreadsheet — scheduled programs, 80G receipts, and GST invoices generated automatically. The same console also books organizational events (RWAs, offsites, NGO programs), one switch away.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} ${plexMono.variable}`}>
      <body className="flex min-h-screen flex-col font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-orange-500 focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <SiteNav />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
