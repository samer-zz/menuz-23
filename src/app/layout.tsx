import type { Metadata, Viewport } from "next";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import "@fontsource/tajawal/400.css";
import "@fontsource/tajawal/500.css";
import "@fontsource/tajawal/700.css";
import "@fontsource/tajawal/800.css";
import "./globals.css";
import { AppProvider } from "@/components/providers/theme-provider";
import { PwaRegister } from "@/components/pwa/pwa-register";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://menuz-23.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "مينوز | MENUZ — امسح .. اطلب .. واستمتع",
    template: "%s | مينوز MENUZ",
  },
  description:
    "منصة مينوز (MENUZ) من تطوير شركة سامرز للحلول الذكية — حلول المنيو الرقمي التفاعلي عبر QR، إدارة الطلبات والمحافظ الإلكترونية، ولوحة تحكم سحابية متكاملة.",
  applicationName: "مينوز | MENUZ",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "ar_YE",
    url: siteUrl,
    siteName: "مينوز | MENUZ",
    title: "مينوز | MENUZ — منصة المنيو الرقمي الذكي",
    description:
      "امسح .. اطلب .. واستمتع | تجربة منيو رقمي فاخرة للمطاعم والكافيهات من شركة سامرز للحلول الذكية.",
    images: [{ url: "/branding/menuz_brand_showcase.png", width: 1200, height: 800 }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#040E21" },
    { media: "(prefers-color-scheme: light)", color: "#0B2D5B" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="dark" suppressHydrationWarning>
      <body className="font-sans antialiased min-h-screen selection:bg-brand-orange/30 selection:text-white">
        <AppProvider>
          <PwaRegister />
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
