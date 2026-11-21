import type { Metadata } from "next";
import Link from "next/link";
import { addTransaction, deleteTransaction } from "@/app/actions/shop";
import { ActionForm, inputCls, L } from "@/components/master-forms";
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
  const supabase = await createClient();
  // A RLS decide o que cada papel enxerga: dono vê tudo; barbeiro só as receitas dos próprios atendimentos.
  const { data } = await supabase
    .from("transactions")
    .select("id, type, category, amount_cents, description, occurred_on, appointment_id, professional_id")
    .eq("barbershop_id", barbershop.id).gte("occurred_on", from).lt("occurred_on", to).order("occurred_on", { ascending: false });
  const tx = (data ?? []) as Tx[];
  const income = tx.filter((t) => t.type === "income").reduce((a, t) => a + t.amount_cents, 0);
  const expense = tx.filter((t) => t.type === "expense").reduce((a, t) => a + t.amount_cents, 0);
  const base = `/painel/${slug}/financeiro`;
  const pill = "rounded-xl border border-line px-3.5 py-2 text-sm hover:bg-surface";
  const nav = (
    <div className="mt-4 flex items-center gap-2">
      <Link href={`${base}?mes=${shiftMonth(mes, -1)}`} className={pill}>←</Link>
      <span className="px-2 text-sm font-medium">{monthLabel(mes)}</span>
      <Link href={`${base}?mes=${shiftMonth(mes, 1)}`} className={pill}>→</Link>
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
    const top = [...visits.values()].sort((a, b) => b.n - a.n).slice(0, 5);
    const cards: [string, string][] = [["Atendimentos concluídos", String(rows.length)], ["Faturado", brl(income)], [`Comissão (${percent}%)`, brl(Math.round((income * percent) / 100))], ["Clientes atendidos", String(visits.size)]];
    return (
      <>
        <h1 className="text-2xl font-semibold">Meus ganhos</h1>
        {nav}
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map(([l, v]) => <div key={l} className="rounded-2xl border border-line bg-surface p-4"><p className="text-xs uppercase tracking-wide text-muted">{l}</p><p className="mt-1 text-2xl font-semibold">{v}</p></div>)}
        </div>
        <h2 className="mt-8 mb-3 text-lg font-medium">Clientes mais frequentes no mês</h2>
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface text-sm">
          {top.length === 0 ? <li className="p-4 text-muted">Sem atendimentos concluídos neste mês.</li> : top.map((c, i) => <li key={i} className="flex justify-between p-3"><span>{c.name}</span><span className="text-muted">{c.n} atendimento(s)</span></li>)}
        </ul>
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
  const cards: [string, string][] = [["Receitas", brl(income)], ["Despesas", brl(expense)], ["Saldo", brl(income - expense)]];

  return (
    <>
      <h1 className="text-2xl font-semibold">Financeiro</h1>
      {nav}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map(([l, v]) => <div key={l} className="rounded-2xl border border-line bg-surface p-4"><p className="text-xs uppercase tracking-wide text-muted">{l}</p><p className="mt-1 text-2xl font-semibold">{v}</p></div>)}
      </div>

      <h2 className="mt-8 mb-3 text-lg font-medium">Comissão por profissional</h2>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="text-muted"><tr>{["Profissional", "Faturado", "%", "A pagar"].map((h) => <th key={h} className="p-3 font-normal">{h}</th>)}</tr></thead>
          <tbody>
            {byPro.length === 0 ? <tr><td colSpan={4} className="p-4 text-muted">Nenhum atendimento concluído neste mês.</td></tr> : byPro.map((r) => (
              <tr key={r.name} className="border-t border-line"><td className="p-3">{r.name}</td><td className="p-3">{brl(r.gross)}</td><td className="p-3">{r.pct}%</td><td className="p-3 font-medium">{brl(r.due)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 mb-3 text-lg font-medium">Novo lançamento</h2>
      <ActionForm action={addTransaction} submit="Registrar" className="grid max-w-2xl gap-3 sm:grid-cols-2">
        <input type="hidden" name="slug" value={slug} />
        <L label="Tipo"><select name="type" className={inputCls} defaultValue="expense"><option value="expense">Despesa</option><option value="income">Receita</option></select></L>
        <L label="Valor (R$)"><input name="amount" inputMode="decimal" required placeholder="50,00" className={inputCls} /></L>
        <L label="Categoria"><input name="category" placeholder="aluguel, produtos..." className={inputCls} /></L>
        <L label="Data"><input name="date" type="date" required defaultValue={today} className={inputCls} /></L>
        <div className="sm:col-span-2"><L label="Descrição (opcional)"><input name="description" className={inputCls} /></L></div>
      </ActionForm>

      <h2 className="mt-8 mb-3 text-lg font-medium">Lançamentos do mês</h2>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-surface text-sm">
        {tx.length === 0 ? <li className="p-4 text-muted">Nenhum lançamento neste mês.</li> : tx.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 p-3">
            <span>
              <span className={t.type === "income" ? "text-success" : "text-danger"}>{t.type === "income" ? "+" : "−"} {brl(t.amount_cents)}</span>{" "}
              <span className="text-muted">· {t.category}{t.description ? ` · ${t.description}` : ""} · {dateBR(t.occurred_on)}{t.appointment_id ? " · atendimento" : ""}</span>
            </span>
            {t.appointment_id ? null : (
              <form action={deleteTransaction}>
                <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={t.id} /><input type="hidden" name="mes" value={mes} />
                <button className="rounded-lg border border-line px-2.5 py-1 hover:bg-surface-2">Excluir</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
