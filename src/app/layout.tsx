import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppChrome from "@/components/app-chrome";
import Script from "next/script";
import TelegramSession from "@/components/telegram-session";
import PwaInstall from "@/components/pwa-install";
import StartupSplash from "@/components/startup-splash";
import AuthGate from "@/components/auth-gate";

export const metadata: Metadata = {
  title: "GMO ARENA | Play. Compete. Predict.",
  description: "Play games, join tournaments, and predict sports events with GMO Arena.",
  applicationName: "GMO ARENA",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "GMO ARENA", statusBarStyle: "black-translucent" },
  icons: { icon: [{ url: "/icons/gmo-arena-192.svg", type: "image/svg+xml" }], apple: [{ url: "/icons/gmo-arena-192.svg" }] },
};

export const viewport: Viewport = {
  themeColor: "#090b0d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr">
      <head><meta name="mobile-web-app-capable" content="yes" /><meta name="apple-mobile-web-app-capable" content="yes" /><meta name="apple-mobile-web-app-title" content="GMO ARENA" /><link rel="manifest" href="/manifest.webmanifest" /><Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" /></head>
      <body>
        <StartupSplash />
        <TelegramSession />
        {children}
        <AppChrome />
        <PwaInstall />
        <AuthGate />
      </body>
    </html>
  );
}
