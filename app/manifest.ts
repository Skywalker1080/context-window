import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Context Window",
    short_name: "CtxWindow",
    description:
      "A high-performance personal knowledge management tool. Capture, triage, and organize web links with surgical precision.",
    start_url: "/",
    display: "standalone",
    background_color: "#05050a",
    theme_color: "#7c3aed",
    orientation: "portrait-primary",
    categories: ["productivity", "utilities"],
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
