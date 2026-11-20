import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { brl, dateBR, STATUS_LABEL, STATUS_TONE } from "@/lib/format";

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
type Due = { status: string; due_on: string; price_cents: number; barbershops: { name: string; slug: string } | null };

export default async function MasterPage() {
  const supabase = await createClient();
  const [{ data: stats }, { data: due }] = await Promise.all([
    supabase.rpc("master_stats"),
    supabase
      .from("subscriptions")
      .select("status, due_on, price_cents, barbershops(name, slug)")
      .in("status", ["pending", "overdue", "active"])
      .order("due_on")
      .limit(8),
  ]);
  const s = stats as Stats | null;
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
  const rows = (due ?? []) as unknown as Due[];

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Link href="/master/barbearias/nova" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:brightness-110">
          Nova Barbearia
        </Link>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-lg font-semibold">Próximos vencimentos</h2>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr><th className="p-3 font-normal">Barbearia</th><th className="p-3 font-normal">Vencimento</th><th className="p-3 font-normal">Valor</th><th className="p-3 font-normal">Status</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="p-4 text-muted">Nenhuma assinatura ainda. Crie a primeira barbearia.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.barbershops?.slug} className="border-t border-line">
                <td className="p-3"><Link className="hover:text-accent" href={`/master/barbearias/${r.barbershops?.slug}`}>{r.barbershops?.name}</Link></td>
                <td className="p-3">{dateBR(r.due_on)}</td>
                <td className="p-3">{brl(r.price_cents)}</td>
                <td className="p-3"><span className={`rounded-full border px-2.5 py-0.5 text-xs ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
