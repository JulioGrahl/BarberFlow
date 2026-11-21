import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { brl, dateBR, daysAgo, STATUS_LABEL, STATUS_TONE } from "@/lib/format";
import { shopFlags, type ShopInsight } from "@/lib/insights";
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
  const [{ data: stats }, { data: subsData }, { data: payData }, { data: insData }] = await Promise.all([
    supabase.rpc("master_stats"),
    supabase.from("subscriptions").select("status, due_on, price_cents, barbershops(name, slug)").order("due_on"),
    supabase.from("payments").select("amount_cents, reference_month, kind, paid_on"),
    supabase.rpc("admin_shop_insights"),
  ]);
  const shops = ((insData ?? []) as ShopInsight[]).filter((r) => r.status !== "cancelled");
  const attention = shops.map((r) => ({ r, flags: shopFlags(r) })).filter((x) => x.flags.length > 0 && x.flags.some((f) => f.key !== "implantacao"));
  const count = (k: string) => shops.filter((r) => shopFlags(r).some((f) => f.key === k)).length;
  const blockedCount = shops.filter((r) => r.status === "suspended").length;
  const topShops = [...shops].sort((a, b) => b.customers_total - a.customers_total).slice(0, 6);
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
        actions={<Link href="/master/barbearias/nova" className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-hover"><Plus size={16} aria-hidden /> Nova barbearia</Link>} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Receita recorrente (mensal)" value={brl(mrr)} hero><span className="text-xs text-muted">Soma das mensalidades das assinaturas ativas</span></Stat>
        <Stat label="Recebido no mês" value={brl(s?.received_this_month_cents ?? 0)}><span className="text-xs text-muted">mensalidades e implantações</span></Stat>
        <Stat label="A receber ou em atraso" value={brl(atRisk || (s?.pending_cents ?? 0))} />
        <Stat label="Implantações" value={brl(setupTotal)}><span className="text-xs text-muted">{brl(setupThisMonth)} neste mês · total recebido</span></Stat>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {([["vencida", "Vencidas ou em atraso", count("vencida"), "danger"], ["inativa", "Sem uso há mais de 14 dias", count("inativa"), "warn"], ["sem_dono", "Dono ainda não entrou", count("sem_dono"), "warn"], ["implantacao", "Implantação a receber", count("implantacao"), "muted"]] as const).map(([k, label, n, tone]) => (
          <Link key={k} href={`/master/barbearias?atencao=${k}`} className={`rounded-2xl border p-4 transition hover:border-night ${n > 0 && tone === "danger" ? "border-danger/30 bg-danger-bg" : n > 0 && tone === "warn" ? "border-warn/30 bg-warn-bg" : "border-line bg-surface"}`}>
            <p className="font-display text-4xl leading-none">{n}</p><p className="mt-1.5 text-xs text-muted">{label}</p>
          </Link>
        ))}
        <Link href="/master/barbearias?status=suspended" className="rounded-2xl border border-line bg-surface p-4 transition hover:border-night"><p className="font-display text-4xl leading-none">{blockedCount}</p><p className="mt-1.5 text-xs text-muted">Bloqueadas</p></Link>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Panel title="Precisam de atenção" sub="Cobrança vencida, pouco uso ou dono que ainda não entrou" className="lg:col-span-3">
          {attention.length === 0 ? <Empty>Nenhuma barbearia precisa de atenção agora.</Empty> : (
            <ul className="divide-y divide-line text-sm">
              {attention.slice(0, 8).map(({ r, flags }) => (
                <li key={r.shop_id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <span><Link className="font-display text-xl leading-none hover:text-accent" href={`/master/barbearias/${r.slug}`}>{r.name}</Link><span className="mt-1 flex flex-wrap gap-1">{flags.map((f) => <span key={f.key} className="rounded-full bg-warn-bg px-2 py-0.5 text-[11px] text-warn">{f.label}</span>)}</span></span>
                  <span className="text-right text-xs text-muted">{r.customers_total} clientes<br />{brl(r.price_cents ?? 0)}/mês</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Barbearias com mais clientes" sub="As que mais dependem do sistema: prioridade de atendimento" className="lg:col-span-2">
          {topShops.length === 0 ? <Empty>Nenhuma barbearia ainda.</Empty> : <HBars items={topShops.map((r) => ({ label: r.name, value: r.customers_total, text: `${r.customers_total} clientes`, hint: `${r.name}: ${r.customers_total} clientes, ${r.appointments_30d} agendamentos em 30 dias` }))} />}
        </Panel>
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
                <span className="flex items-center gap-3"><span className="font-display text-2xl leading-tight">{brl(r.price_cents)}</span><span className={`rounded-full border px-2.5 py-0.5 text-xs ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span></span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
