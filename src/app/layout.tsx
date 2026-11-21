import type { Metadata, Viewport } from "next";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/instrument-sans/index.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "BarberFlow", template: "%s · BarberFlow" },
  description: "Agendamento e gestão para barbearias.",
  applicationName: "BarberFlow",
  appleWebApp: { capable: true, title: "BarberFlow", statusBarStyle: "black-translucent" },
  icons: { apple: "/apple-touch-icon.png" }, // favicon: src/app/icon.svg e favicon.ico (convenção do Next)
};

export const viewport: Viewport = {
  themeColor: "#0e1b25",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full antialiased" style={{ ["--font-body" as string]: "'Instrument Sans Variable'", ["--font-head" as string]: "'Archivo Variable'" }}>
      <body className="min-h-full flex flex-col bg-bg text-ink">{children}</body>
    </html>
  );
}
