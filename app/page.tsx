"use client";

import dynamic from "next/dynamic";

// Firebase relies on browser APIs, so we disable SSR prerendering
// per Next.js docs: ssr: false must be in a Client Component
const AppShell = dynamic(() => import("@/components/AppShell"), {
  ssr: false,
});

export default function Home() {
  return <AppShell />;
}
