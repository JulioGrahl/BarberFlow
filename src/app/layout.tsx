import type { Metadata, Viewport } from "next";
import "@fontsource-variable/fraunces/index.css";
import "@fontsource-variable/hanken-grotesk/index.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "BarberFlow", template: "%s · BarberFlow" },
  description: "Agendamento e gestão para barbearias.",
  applicationName: "BarberFlow",
  appleWebApp: { capable: true, title: "BarberFlow", statusBarStyle: "black" },
  icons: { icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0e1512",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full antialiased" style={{ ["--font-hanken" as string]: "'Hanken Grotesk Variable'", ["--font-fraunces" as string]: "'Fraunces Variable'" }}>
      <body className="min-h-full flex flex-col bg-bg text-ink">{children}</body>
    </html>
  );
}
