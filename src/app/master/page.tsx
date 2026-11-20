import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Painel Master" };

type Stats = {
  barbershops_total: number;
  barbershops_active: number;
  barbershops_suspended: number;
  users_total: number;
  appointments_total: number;
  received_this_month_cents: number;
  pending_cents: number;
};

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Painel Master (somente SUPER_ADMIN). Versão completa na Etapa 6.
export default async function MasterPage() {
  await requireSuperAdmin();
  const supabase = await createClient();
  const { data } = await supabase.rpc("master_stats");
  const s = data as Stats | null;
  const cards: [string, string][] = s
    ? [
        ["Barbearias", String(s.barbershops_total)],
        ["Ativas", String(s.barbershops_active)],
        ["Suspensas", String(s.barbershops_suspended)],
        ["Usuários", String(s.users_total)],
        ["Agendamentos", String(s.appointments_total)],
        ["Recebido no mês", brl(s.received_this_month_cents)],
        ["Pendente", brl(s.pending_cents)],
      ]
    : [];
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Painel Master</h1>
        <form action="/auth/signout" method="post">
          <button className="rounded-xl border border-line px-3.5 py-2 text-sm hover:bg-surface">Sair</button>
        </form>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
