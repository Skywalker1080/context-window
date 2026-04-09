"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";

// Firebase relies on browser APIs, so we disable SSR prerendering
// per Next.js docs: ssr: false must be in a Client Component
const AppShell = dynamic(() => import("@/components/AppShell"), {
  ssr: false,
});

export default function Home() {
  // Register the service worker so the browser can prompt PWA install
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("SW registration failed:", err);
      });
    }
  }, []);

  return <AppShell />;
}
