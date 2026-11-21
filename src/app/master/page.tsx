import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { brl, dateBR, daysAgo, STATUS_LABEL, STATUS_TONE } from "@/lib/format";
import { AreaChart, HBars } from "@/components/charts";
import { Empty, PageHead, Panel, Stat } from "@/components/kit";

export const metadata: Metadata = { title: "Visão geral · Master" };

type Stats = {
  barbershops_total: number; barbershops_active: number; barbershops_suspended: number;
  users_total: number; appointments_total: number; received_this_month_cents: number; pending_cents: number;
};
type Sub = { status: string; due_on: string; price_cents: number; barbershops: { name: string; slug: string } | null };

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export default async function MasterPage() {
  const supabase = await createClient();
  const today = daysAgo(0);
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 - (5 - i), 1));
    return { key: d.toISOString().slice(0, 7), label: `${MONTHS[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}` };
  });
  const [{ data: stats }, { data: subsData }, { data: payData }] = await Promise.all([
    supabase.rpc("master_stats"),
    supabase.from("subscriptions").select("status, due_on, price_cents, barbershops(name, slug)").order("due_on"),
    supabase.from("payments").select("amount_cents, reference_month, kind, paid_on"),
  ]);
  const s = stats as Stats | null;
  const subs = (subsData ?? []) as unknown as Sub[];
  const mrr = subs.filter((x) => x.status === "active").reduce((a, x) => a + x.price_cents, 0);
  const atRisk = subs.filter((x) => x.status === "overdue" || x.status === "pending").reduce((a, x) => a + x.price_cents, 0);
  const pays = (payData ?? []) as { amount_cents: number; reference_month: string; kind: string; paid_on: string }[];
  const sumMonth = (key: string, kind: string) => pays.filter((p) => p.kind === kind && p.reference_month.startsWith(key)).reduce((a, p) => a + p.amount_cents, 0) / 100;
  const perMonth = months.map((m) => sumMonth(m.key, "monthly"));
  const setupMonth = months.map((m) => sumMonth(m.key, "setup"));
  const setupTotal = pays.filter((p) => p.kind === "setup").reduce((a, p) => a + p.amount_cents, 0);
  const setupThisMonth = pays.filter((p) => p.kind === "setup" && p.paid_on.startsWith(today.slice(0, 7))).reduce((a, p) => a + p.amount_cents, 0);
  const byStatus = Object.keys(STATUS_LABEL).map((k) => ({ label: STATUS_LABEL[k], value: subs.filter((x) => x.status === k).length, text: String(subs.filter((x) => x.status === k).length) })).filter((x) => x.value > 0);
  const upcoming = subs.filter((x) => ["pending", "overdue", "active"].includes(x.status)).slice(0, 8);

  return (
    <>
      <PageHead title="Visão geral" sub="Mensalidades e saúde da base de barbearias"
        actions={<Link href="/master/barbearias/nova" className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-ink hover:brightness-110"><Plus size={16} aria-hidden /> Nova barbearia</Link>} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Receita recorrente (mensal)" value={brl(mrr)} hero><span className="text-xs text-muted">Soma das mensalidades das assinaturas ativas</span></Stat>
        <Stat label="Recebido no mês" value={brl(s?.received_this_month_cents ?? 0)}><span className="text-xs text-muted">mensalidades e implantações</span></Stat>
        <Stat label="A receber ou em atraso" value={brl(atRisk || (s?.pending_cents ?? 0))} />
        <Stat label="Implantações" value={brl(setupTotal)}><span className="text-xs text-muted">{brl(setupThisMonth)} neste mês · total recebido</span></Stat>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Panel title="Recebimentos por mês" sub="Pelo mês de referência do pagamento" className="lg:col-span-3">
          {perMonth.every((v) => v === 0) && setupMonth.every((v) => v === 0) ? <Empty>Registre o primeiro pagamento na página de uma barbearia para ver a evolução.</Empty> :
            <AreaChart labels={months.map((m) => m.label)} series={[{ name: "Mensalidades", color: "var(--c1)", values: perMonth }, { name: "Implantações", color: "var(--c2)", values: setupMonth }]} tickEvery={1} />}
        </Panel>
        <Panel title="Barbearias por situação" sub={`${s?.barbershops_total ?? 0} no total · ${s?.users_total ?? 0} usuários · ${s?.appointments_total ?? 0} agendamentos`} className="lg:col-span-2">
          {byStatus.length === 0 ? <Empty>Nenhuma assinatura ainda.</Empty> : <HBars items={byStatus} color="var(--c2)" />}
        </Panel>
      </div>
      <Panel title="Próximos vencimentos" className="mt-4">
        {upcoming.length === 0 ? <Empty>Nenhuma assinatura ainda. Crie a primeira barbearia.</Empty> : (
          <ul className="divide-y divide-line text-sm">
            {upcoming.map((r) => (
              <li key={r.barbershops?.slug} className="flex items-center justify-between gap-3 py-3">
                <span><Link className="font-medium hover:text-accent" href={`/master/barbearias/${r.barbershops?.slug}`}>{r.barbershops?.name}</Link><span className="block text-xs text-muted">vence em {dateBR(r.due_on)}</span></span>
                <span className="flex items-center gap-3"><span className="font-display text-lg">{brl(r.price_cents)}</span><span className={`rounded-full border px-2.5 py-0.5 text-xs ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span></span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
