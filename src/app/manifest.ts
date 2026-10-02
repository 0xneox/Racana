import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Racana",
    short_name: "Racana",
    description:
      "Professional book interior typesetting for independent authors.",
    start_url: "/",
    display: "standalone",
    background_color: "#F8F5EE",
    theme_color: "#1C1917",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
