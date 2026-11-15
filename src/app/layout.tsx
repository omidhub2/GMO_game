import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppChrome from "@/components/app-chrome";
import Script from "next/script";
import TelegramSession from "@/components/telegram-session";

export const metadata: Metadata = {
  title: "GMO ARENA | Play. Compete. Predict.",
  description: "Play games, join tournaments, and predict sports events with GMO Arena.",
  applicationName: "GMO ARENA",
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
      <head><Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" /></head>
      <body>
        <TelegramSession />
        {children}
        <AppChrome />
      </body>
    </html>
  );
}
