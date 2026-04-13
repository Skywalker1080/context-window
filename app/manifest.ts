import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Context Window",
    short_name: "Context Window",
    description:
      "A high-performance personal knowledge management tool. Capture, triage, and organize web links with surgical precision.",
    start_url: "/",
    display: "standalone",
    background_color: "#CC6B4F",
    theme_color: "#CC6B4F",
    orientation: "portrait-primary",
    categories: ["productivity", "utilities"],
    icons: [
      {
        src: "/icons/ctx_logo-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/ctx_logo-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
