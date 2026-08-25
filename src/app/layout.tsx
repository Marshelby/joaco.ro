import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CartProvider } from "@/components/cart/cart-provider";
import { BRAND } from "@/config/brand";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.hidroleufu.cl"),
  title: {
    default: "Hidro Leufú | Productos frescos con delivery",
    template: `%s | ${BRAND.name}`,
  },
  description: "Compra verduras, frutas, productos hidropónicos y hierbas frescas con delivery. La feria disponible 24/7.",
  applicationName: BRAND.name,
  creator: BRAND.name,
  publisher: BRAND.name,
  keywords: ["Hidro Leufú", "verduras", "frutas", "hidropónicos", "productos frescos", "delivery", "compra online", "Quilpué", "Valparaíso"],
  openGraph: {
    type: "website",
    locale: "es_CL",
    siteName: BRAND.name,
    url: "/",
    title: "Hidro Leufú | La feria disponible 24/7",
    description: "Productos frescos, hidropónicos, frutas y verduras para comprar online con delivery.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hidro Leufú | La feria disponible 24/7",
    description: "Productos frescos, hidropónicos, frutas y verduras para comprar online con delivery.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={BRAND.locale} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <a href="#main-content" className="sr-only fixed left-4 top-4 z-[100] rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          Ir al contenido principal
        </a>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
