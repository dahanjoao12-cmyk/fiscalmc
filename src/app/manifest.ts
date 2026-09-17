import type { MetadataRoute } from "next";
import { BASE_PATH } from "@/lib/base-path";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Moreira & Castro — NFS-e",
    short_name: "M&C NFS-e",
    description: "Emissão simples e segura de NFS-e.",
    start_url: `${BASE_PATH}/app`,
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#082240",
    orientation: "portrait-primary",
    icons: [
      { src: `${BASE_PATH}/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${BASE_PATH}/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" }
    ]
  };
}
