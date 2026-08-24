import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Moreira & Castro — NFS-e",
    short_name: "M&C NFS-e",
    description: "Emissão simples e segura de NFS-e.",
    start_url: "/app",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#082240",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" }
    ]
  };
}
