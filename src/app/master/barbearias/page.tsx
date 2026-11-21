import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { brl, dateBR, relDay, STATUS_LABEL, STATUS_TONE } from "@/lib/format";
import { shopFlags, type Flag, type ShopInsight } from "@/lib/insights";
import { PageHead } from "@/components/kit";

export const metadata: Metadata = { title: "Barbearias · Master" };

const ORDER: Record<string, string> = { clientes: "Mais clientes", atividade: "Mais agendamentos (30 dias)", receita: "Maior movimento (30 dias)", vencimento: "Vencimento mais próximo", nome: "Nome" };
const FLAG_TONE: Record<Flag["key"], string> = { vencida: "bg-danger-bg text-danger", inativa: "bg-warn-bg text-warn", sem_dono: "bg-warn-bg text-warn", implantacao: "bg-surface-2 text-muted" };

export default async function ShopsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; ordem?: string; encerradas?: string; excluida?: string; atencao?: string }> }) {
  const { q = "", status = "", ordem = "clientes", encerradas = "", excluida = "", atencao = "" } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_shop_insights");
  const all = (data ?? []) as ShopInsight[];
  const closed = all.filter((r) => r.status === "cancelled");
  let rows = encerradas ? closed : all.filter((r) => r.status !== "cancelled");
  const term = q.trim().toLowerCase();
  if (term) rows = rows.filter((r) => r.name.toLowerCase().includes(term) || r.slug.includes(term));
  if (status) rows = rows.filter((r) => r.status === status);
  if (atencao) rows = rows.filter((r) => shopFlags(r).some((f) => f.key === atencao));
  const sorters: Record<string, (a: ShopInsight, b: ShopInsight) => number> = {
    clientes: (a, b) => b.customers_total - a.customers_total,
    atividade: (a, b) => b.appointments_30d - a.appointments_30d,
    receita: (a, b) => b.revenue_30d_cents - a.revenue_30d_cents,
    vencimento: (a, b) => (a.due_on ?? "9").localeCompare(b.due_on ?? "9"),
    nome: (a, b) => a.name.localeCompare(b.name),
  };
  rows = [...rows].sort(sorters[ordem] ?? sorters.clientes);
  const tab = (on: boolean) => `rounded-md px-3 py-1.5 text-sm ${on ? "bg-night font-medium text-white" : "text-muted hover:text-ink"}`;

  return (
    <>
      <PageHead title="Barbearias" sub={`${all.length - closed.length} no ar · ${closed.length} ${closed.length === 1 ? "encerrada" : "encerradas"}`}
        actions={<Link href="/master/barbearias/nova" className="rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-hover">Nova barbearia</Link>} />
      {excluida ? <p role="status" className="mb-4 rounded-lg border border-success/30 bg-success-bg px-3.5 py-2.5 text-sm text-success">Barbearia excluída definitivamente.</p> : null}
      <div className="mb-4 inline-flex gap-1 rounded-lg border border-line bg-surface p-1">
        <Link href="/master/barbearias" className={tab(!encerradas)}>No ar</Link>
        <Link href="/master/barbearias?encerradas=1" className={tab(!!encerradas)}>Encerradas ({closed.length})</Link>
      </div>
      <form className="flex flex-wrap gap-2">
        {encerradas ? <input type="hidden" name="encerradas" value="1" /> : null}
        <input name="q" defaultValue={q} placeholder="Buscar por nome ou endereço" className="min-w-0 flex-1 rounded-lg border px-3.5 py-2 text-base" />
        {!encerradas ? (
          <select name="status" defaultValue={status} className="rounded-lg border px-3 py-2 text-base" aria-label="Status">
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABEL).filter(([k]) => k !== "cancelled").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        ) : null}
        <select name="atencao" defaultValue={atencao} className="rounded-lg border px-3 py-2 text-base" aria-label="Atenção">
          <option value="">Qualquer situação</option>
          <option value="vencida">Vencidas ou em atraso</option>
          <option value="inativa">Sem uso recente</option>
          <option value="sem_dono">Dono não entrou</option>
          <option value="implantacao">Implantação a receber</option>
        </select>
        <select name="ordem" defaultValue={ordem} className="rounded-lg border px-3 py-2 text-base" aria-label="Ordenar">
          {Object.entries(ORDER).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="rounded-lg border border-line-strong px-4 py-2 text-sm hover:bg-surface">Aplicar</button>
      </form>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="border-b border-line bg-surface-2 text-xs text-muted">
            <tr>{["Barbearia", "Clientes", "Agend. 30 dias", "Movimento 30 dias", "Último agend.", "Mensalidade", "Implantação", "Status"].map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="p-6 text-center text-muted">{encerradas ? "Nenhuma barbearia encerrada." : "Nenhuma barbearia encontrada."}</td></tr>
            ) : rows.map((r) => {
              const flags = shopFlags(r);
              const pending = r.setup_fee_cents - r.setup_paid_cents;
              return (
                <tr key={r.shop_id} className="border-t border-line align-top">
                  <td className="p-3">
                    <Link href={`/master/barbearias/${r.slug}`} className="font-display text-xl leading-none hover:text-accent">{r.name}</Link>
                    <p className="mt-0.5 text-xs text-muted">/b/{r.slug}</p>
                    {flags.length ? <p className="mt-1.5 flex flex-wrap gap-1">{flags.map((f) => <span key={f.key} className={`rounded-full px-2 py-0.5 text-[11px] ${FLAG_TONE[f.key]}`}>{f.label}</span>)}</p> : null}
                  </td>
                  <td className="p-3"><span className="font-display text-2xl leading-none">{r.customers_total}</span>{r.customers_30d > 0 ? <span className="block text-xs text-success">+{r.customers_30d} em 30 dias</span> : null}</td>
                  <td className="p-3 tabular-nums">{r.appointments_30d}</td>
                  <td className="p-3 tabular-nums">{brl(r.revenue_30d_cents)}</td>
                  <td className="p-3 text-muted">{r.last_appointment_at ? relDay(r.last_appointment_at) : "nunca"}</td>
                  <td className="p-3"><span className="tabular-nums">{r.price_cents != null ? brl(r.price_cents) : "—"}</span><span className="block text-xs text-muted">vence {dateBR(r.due_on)}</span></td>
                  <td className="p-3 text-xs">{r.setup_fee_cents === 0 && r.setup_paid_cents === 0 ? <span className="text-muted">—</span> : pending > 0 ? <span className="text-warn">falta {brl(pending)}</span> : <span className="text-success">pago</span>}</td>
                  <td className="p-3">{r.status ? <span className={`rounded-full border px-2.5 py-0.5 text-xs ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span> : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
