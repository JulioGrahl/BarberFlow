import type { Metadata } from "next";
import { getProfile, requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Minha conta" };

// Área do cliente (conteúdo completo na Etapa 12).
export default async function CustomerArea() {
  await requireUser("/app");
  const profile = await getProfile();
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Olá, {profile?.full_name?.split(" ")[0] || "cliente"}</h1>
        <form action="/auth/signout" method="post">
          <button className="rounded-xl border border-line px-3.5 py-2 text-sm hover:bg-surface">Sair</button>
        </form>
      </div>
      <p className="mt-4 text-sm text-muted">Seus agendamentos e histórico aparecerão aqui.</p>
    </main>
  );
}
