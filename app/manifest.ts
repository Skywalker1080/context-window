import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Context Window",
    short_name: "CtxWindow",
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
        src: "/context_window.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      {
        src: "/context_window.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
