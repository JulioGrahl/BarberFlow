import type { NextConfig } from "next";

// Cache Components fica desligado de propósito: o produto é um painel autenticado
// e dinâmico, e a renderização dinâmica padrão é mais simples e portável entre hosts.
const nextConfig: NextConfig = {
  // Esconde o botão "N" do modo de desenvolvimento, que fica por cima do menu no celular (não existe em produção).
  devIndicators: false,
  // Fotos já são reduzidas no navegador (≈300 KB), mas o padrão de 1 MB é apertado para formulário com imagem.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
