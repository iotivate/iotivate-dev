import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://iotivate.dev";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "iotivate.dev — Simplifying IoT, One Module at a Time",
    template: "%s | iotivate.dev",
  },
  description:
    "We build practical tools, firmware, and hardware that make ESP32 and IoT projects easier to create, share, and deploy.",
  keywords: ["IoT", "ESP32", "firmware", "web flasher", "tools", "hardware", "pin planner", "serial monitor"],
  icons: {
    icon: "/favicon-32.png",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "iotivate.dev",
    locale: "en_US",
    title: "iotivate.dev — Simplifying IoT, One Module at a Time",
    description:
      "Practical web-based tools, firmware, and hardware for ESP32 and IoT projects. No installs required.",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "iotivate.dev — Simplifying IoT, One Module at a Time",
    description:
      "Practical web-based tools, firmware, and hardware for ESP32 and IoT projects. No installs required.",
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script src="https://app.lemonsqueezy.com/js/lemon.js" defer></script>
        <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "2e33c80f6fb84f47b23fcdb91e309f4a"}'></script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <AuthProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
