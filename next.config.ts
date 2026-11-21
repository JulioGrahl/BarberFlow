import type { NextConfig } from "next";

// Cache Components fica desligado de propósito: o produto é um painel autenticado
// e dinâmico, e a renderização dinâmica padrão é mais simples e portável entre hosts.
const nextConfig: NextConfig = {
  // Esconde o botão "N" do modo de desenvolvimento, que fica por cima do menu no celular (não existe em produção).
  devIndicators: false,
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
