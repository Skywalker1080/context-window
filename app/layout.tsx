import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://context-window.vercel.app"),
  title: "Context Window — Capture. Triage. Organize.",
  description:
    "A high-performance personal knowledge management tool for capturing, triaging, and organizing web links with surgical precision.",
  applicationName: "Context Window",
  icons: {
    icon: "/icons/ctx_logo-192x192.png",
    shortcut: "/icons/ctx_logo-192x192.png",
    apple: "/icons/ctx_logo-192x192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Context Window",
  },
  openGraph: {
    title: "Context Window — Capture. Triage. Organize.",
    description: "A high-performance personal knowledge management tool for capturing, triaging, and organizing web links with surgical precision.",
    siteName: "Context Window",
    images: [
      {
        url: "/icons/ctx_logo-512x512.png",
        width: 512,
        height: 512,
        alt: "Context Window Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Context Window",
    description: "Personal Knowledge Management for links with surgical precision.",
    images: ["/icons/ctx_logo-512x512.png"],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#CC6B4F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} dark`}
    >
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
