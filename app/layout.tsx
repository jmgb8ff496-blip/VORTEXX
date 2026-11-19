import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "VORTEX", description: "Мессенджер VORTEX", manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "VORTEX", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#080B09" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ru"><body className="min-h-dvh">{children}</body></html>;
}
