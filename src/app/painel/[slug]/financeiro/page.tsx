import type { Metadata } from "next";
import Link from "next/link";
import { addTransaction, deleteTransaction } from "@/app/actions/shop";
import { ActionForm, inputCls, L } from "@/components/master-forms";
import { Drawer } from "@/components/drawer";
import { AreaChart, HBars } from "@/components/charts";
import { Delta, Empty, PageHead, Panel, Stat, pctChange } from "@/components/kit";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { requireShopAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { brl, dateBR, nextDays } from "@/lib/format";

export const metadata: Metadata = { title: "Financeiro" };

const monthRange = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { from: `${ym}-01`, to: `${next}-01` };
};
const shiftMonth = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const monthLabel = (ym: string) => `${ym.slice(5)}/${ym.slice(0, 4)}`;

type Tx = { id: string; type: "income" | "expense"; category: string; amount_cents: number; description: string | null; occurred_on: string; appointment_id: string | null; professional_id: string | null };

export default async function FinancePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ mes?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { role, barbershop } = await requireShopAccess(slug);
  const today = nextDays(1)[0];
  const mes = sp.mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mes) ? sp.mes : today.slice(0, 7);
  const { from, to } = monthRange(mes);
  const prevFrom = monthRange(shiftMonth(mes, -1)).from;
  const supabase = await createClient();
  // A RLS decide o que cada papel enxerga: dono vê tudo; barbeiro só as receitas dos próprios atendimentos.
  const { data } = await supabase
    .from("transactions")
    .select("id, type, category, amount_cents, description, occurred_on, appointment_id, professional_id")
    .eq("barbershop_id", barbershop.id).gte("occurred_on", prevFrom).lt("occurred_on", to).order("occurred_on", { ascending: false });
  const all = (data ?? []) as Tx[];
  const tx = all.filter((t) => t.occurred_on >= from);
  const prevTx = all.filter((t) => t.occurred_on < from);
  const sum = (l: Tx[], type: Tx["type"]) => l.filter((t) => t.type === type).reduce((a, t) => a + t.amount_cents, 0);
  const income = sum(tx, "income"), expense = sum(tx, "expense");
  const prevIncome = sum(prevTx, "income"), prevExpense = sum(prevTx, "expense");
  const dim = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5)), 0)).getUTCDate();
  const labels = Array.from({ length: dim }, (_, i) => `${String(i + 1).padStart(2, "0")}/${mes.slice(5)}`);
  const perDay = (type: Tx["type"]) => {
    const v = Array(dim).fill(0) as number[];
    for (const t of tx) if (t.type === type) v[Number(t.occurred_on.slice(8, 10)) - 1] += t.amount_cents / 100;
    return v;
  };
  const base = `/painel/${slug}/financeiro`;
  const arrow = "rounded-lg border border-line p-2 text-muted hover:bg-surface hover:text-ink";
  const actions = (
    <div className="flex items-center gap-1.5">
      <Link href={`${base}?mes=${shiftMonth(mes, -1)}`} className={arrow} aria-label="Mês anterior"><ChevronLeft size={18} /></Link>
      <span className="min-w-20 text-center text-sm font-medium">{monthLabel(mes)}</span>
      <Link href={`${base}?mes=${shiftMonth(mes, 1)}`} className={arrow} aria-label="Próximo mês"><ChevronRight size={18} /></Link>
    </div>
  );

  if (role === "barber") {
    const { data: comm } = await supabase.from("professional_commissions").select("percent").eq("barbershop_id", barbershop.id).maybeSingle();
    const percent = Number(comm?.percent ?? 0);
    const { data: appts } = await supabase
      .from("appointments").select("customer_id, customers(full_name)")
      .eq("barbershop_id", barbershop.id).eq("status", "completed")
      .gte("starts_at", new Date(`${from}T00:00:00-03:00`).toISOString()).lt("starts_at", new Date(`${to}T00:00:00-03:00`).toISOString());
    const rows = (appts ?? []) as unknown as { customer_id: string; customers: { full_name: string } | null }[];
    const visits = new Map<string, { name: string; n: number }>();
    for (const r of rows) { const v = visits.get(r.customer_id) ?? { name: r.customers?.full_name ?? "Cliente", n: 0 }; v.n++; visits.set(r.customer_id, v); }
    const top = [...visits.values()].sort((a, b) => b.n - a.n).slice(0, 6);
    const mine = Math.round((income * percent) / 100);
    return (
      <>
        <PageHead title="Meus ganhos" sub="Só aparecem os atendimentos feitos por você" actions={actions} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={`Sua comissão (${percent}%)`} value={brl(mine)} hero><Delta pct={pctChange(income, prevIncome)} /></Stat>
          <Stat label="Faturado" value={brl(income)} />
          <Stat label="Clientes atendidos" value={String(visits.size)}><span className="text-xs text-muted">{rows.length} atendimentos</span></Stat>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-5">
          <Panel title="Faturamento por dia" className="lg:col-span-3">
            {income === 0 ? <Empty>Nenhum atendimento concluído neste mês.</Empty> : <AreaChart labels={labels} series={[{ name: "Faturado", color: "var(--c1)", values: perDay("income") }]} />}
          </Panel>
          <Panel title="Clientes mais frequentes" className="lg:col-span-2">
            {top.length === 0 ? <Empty>Sem atendimentos concluídos neste mês.</Empty> : <HBars items={top.map((c) => ({ label: c.name, value: c.n, text: `${c.n} ${c.n === 1 ? "vez" : "vezes"}` }))} color="var(--c2)" />}
          </Panel>
        </div>
      </>
    );
  }

  const [{ data: pros }, { data: comms }] = await Promise.all([
    supabase.from("professionals").select("id, display_name").eq("barbershop_id", barbershop.id).order("display_name"),
    supabase.from("professional_commissions").select("professional_id, percent").eq("barbershop_id", barbershop.id),
  ]);
  const byPro = (pros ?? []).map((p) => {
    const gross = tx.filter((t) => t.type === "income" && t.professional_id === p.id).reduce((a, t) => a + t.amount_cents, 0);
    const pct = Number((comms ?? []).find((c) => c.professional_id === p.id)?.percent ?? 0);
    return { name: p.display_name, gross, pct, due: Math.round((gross * pct) / 100) };
  }).filter((r) => r.gross > 0);
  const dueTotal = byPro.reduce((a, r) => a + r.due, 0);
  const cats = new Map<string, number>();
  for (const t of tx) if (t.type === "expense") cats.set(t.category, (cats.get(t.category) ?? 0) + t.amount_cents);
  const catItems = [...cats.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value, text: brl(value) }));
  const profit = income - expense;
  const { data: nsData } = await supabase.from("appointments").select("price_cents")
    .eq("barbershop_id", barbershop.id).eq("status", "no_show")
    .gte("starts_at", new Date(`${from}T00:00:00-03:00`).toISOString()).lt("starts_at", new Date(`${to}T00:00:00-03:00`).toISOString());
  const noShowCents = (nsData ?? []).reduce((a, x) => a + x.price_cents, 0);

  return (
    <>
      <PageHead title="Financeiro" sub="Receitas dos atendimentos entram sozinhas; despesas você lança aqui" actions={
        <>
          {actions}
          <Drawer title="Novo lançamento" trigger={<><Plus size={16} aria-hidden /> Lançar</>}>
            <ActionForm action={addTransaction} submit="Registrar lançamento" className="space-y-4">
              <input type="hidden" name="slug" value={slug} />
              <L label="Tipo"><select name="type" className={inputCls} defaultValue="expense"><option value="expense">Despesa</option><option value="income">Receita avulsa</option></select></L>
              <L label="Valor (R$)"><input name="amount" inputMode="decimal" required placeholder="50,00" className={inputCls} /></L>
              <L label="Categoria"><input name="category" placeholder="aluguel, produtos, luz…" className={inputCls} /></L>
              <L label="Data"><input name="date" type="date" required defaultValue={today} className={inputCls} /></L>
              <L label="Descrição (opcional)"><input name="description" className={inputCls} /></L>
            </ActionForm>
          </Drawer>
        </>
      } />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Lucro do mês" value={brl(profit)} hero>
          <p className="text-xs text-muted">Receitas {brl(income)} menos despesas {brl(expense)}</p>
        </Stat>
        <Stat label="Receitas" value={brl(income)}><Delta pct={pctChange(income, prevIncome)} /></Stat>
        <Stat label="Despesas" value={brl(expense)}><Delta pct={pctChange(expense, prevExpense)} inverse /></Stat>
      </div>

      {nsData && nsData.length > 0 ? (
        <p className="mt-3 text-sm text-muted">{nsData.length} {nsData.length === 1 ? "cliente faltou" : "clientes faltaram"} neste mês: {brl(noShowCents)} que deixaram de entrar. Esse valor não está na receita.</p>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Panel title="Receitas e despesas por dia" className="lg:col-span-3">
          {income + expense === 0 ? <Empty>Sem movimento neste mês.</Empty> :
            <AreaChart labels={labels} series={[{ name: "Receitas", color: "var(--c1)", values: perDay("income") }, { name: "Despesas", color: "var(--c3)", values: perDay("expense") }]} />}
        </Panel>
        <Panel title="Para onde vai o dinheiro" sub="Despesas por categoria" className="lg:col-span-2">
          {catItems.length === 0 ? <Empty>Nenhuma despesa lançada neste mês.</Empty> : <HBars items={catItems} color="var(--c3)" />}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Panel title="Comissões a pagar" sub={dueTotal ? `Total do mês: ${brl(dueTotal)}` : undefined} className="lg:col-span-2">
          {byPro.length === 0 ? <Empty>Nenhum atendimento concluído neste mês.</Empty> : (
            <ul className="divide-y divide-line text-sm">
              {byPro.map((r) => (
                <li key={r.name} className="flex items-center justify-between gap-3 py-2.5">
                  <span><span className="block">{r.name}</span><span className="text-xs text-muted">{brl(r.gross)} faturados · {r.pct}%</span></span>
                  <span className="font-display text-2xl leading-tight">{brl(r.due)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Lançamentos" sub={`${tx.length} no mês`} className="lg:col-span-3">
          {tx.length === 0 ? <Empty>Nenhum lançamento neste mês.</Empty> : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto text-sm">
              {tx.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate">{t.description || t.category}{t.appointment_id ? <span className="text-muted"> · atendimento</span> : null}</span>
                    <span className="text-xs text-muted">{dateBR(t.occurred_on)} · {t.category}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className={t.type === "income" ? "text-success" : "text-danger"}>{t.type === "income" ? "+" : "−"} {brl(t.amount_cents)}</span>
                    {t.appointment_id ? null : (
                      <form action={deleteTransaction}>
                        <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={t.id} /><input type="hidden" name="mes" value={mes} />
                        <button className="rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-danger">Excluir</button>
                      </form>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
