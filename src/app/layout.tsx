import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";

export const metadata: Metadata = {
  title: { default: "Moreira & Castro", template: "%s | Moreira & Castro" },
  description: "Emissão simples e segura de NFS-e.",
  applicationName: "Moreira & Castro",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/favicon-64.png", sizes: "64x64", type: "image/png" }],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }]
  },
  appleWebApp: { capable: true, title: "Moreira & Castro", statusBarStyle: "default" }
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#082240" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}<ServiceWorkerRegistration /></body></html>;
}
