import type { Metadata } from "next";
import { Anton, Archivo, Space_Mono } from "next/font/google";
import { site } from "@/config/site";
import "./globals.css";
import "@/styles/motion.css";

// display "optional": the condensed display face reflows the 11vw hero badly on a late swap (CLS ~0.19);
// fonts are preloaded, so they are used whenever they arrive in time, otherwise that view keeps the fallback.
const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton", display: "optional" });
const archivo = Archivo({ weight: ["500", "700", "800"], subsets: ["latin"], variable: "--font-archivo", display: "optional" });
const spaceMono = Space_Mono({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-space-mono", display: "optional" });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: site.title,
  description: site.description,
  alternates: { canonical: "/" },
  openGraph: { type: "website", url: "/", siteName: site.name, title: site.title, description: site.description },
  twitter: { card: "summary", title: site.title, description: site.description },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the inline script below adds the "js" class before hydration.
    <html lang="en" className={`${anton.variable} ${archivo.variable} ${spaceMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
