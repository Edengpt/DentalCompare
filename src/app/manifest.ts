import type { MetadataRoute } from "next";

/**
 * Lets a phone add the site to its home screen with the brand icon and colour.
 * Language-neutral on purpose: the start URL lets the proxy pick the visitor's
 * language, as it does for any other unprefixed path.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DentalCompare",
    short_name: "DentalCompare",
    start_url: "/",
    display: "browser",
    background_color: "#ffffff",
    theme_color: "#0e2f55",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
