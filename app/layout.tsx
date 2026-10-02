import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wedding Photo Booth",
  description: "An iPad-first wedding photo booth.",
  appleWebApp: {
    capable: true,
    title: "Wedding Photo Booth",
    statusBarStyle: "black-translucent",
    manifest: "/manifest.webmanifest",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  colorScheme: "light",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
