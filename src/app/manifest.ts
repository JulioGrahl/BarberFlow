import type { MetadataRoute } from "next";

// App instalável (PWA): abre em tela cheia, sem barra do navegador. Não guarda dados offline de propósito:
// agenda e financeiro precisam estar sempre atualizados.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BarberFlow",
    short_name: "BarberFlow",
    description: "Agenda e gestão para barbearias.",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0E1B25",
    theme_color: "#0E1B25",
    lang: "pt-BR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
