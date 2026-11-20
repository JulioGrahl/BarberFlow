import type { Metadata } from "next";
import { requireShopAccess } from "@/lib/auth";

export const metadata: Metadata = { title: "Painel" };

// Painel da barbearia (dono e barbeiro). O dashboard completo entra a partir da Etapa 9.
export default async function ShopPanel({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await requireShopAccess(slug);
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">{access.role === "owner" ? "Proprietário" : "Barbeiro"}</p>
          <h1 className="text-2xl font-semibold">{access.barbershop.name}</h1>
        </div>
        <form action="/auth/signout" method="post">
          <button className="rounded-xl border border-line px-3.5 py-2 text-sm hover:bg-surface">Sair</button>
        </form>
      </div>
    </main>
  );
}
