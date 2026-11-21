import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { brl, dateBR, STATUS_LABEL, STATUS_TONE } from "@/lib/format";
import { PageHead } from "@/components/kit";

export const metadata: Metadata = { title: "Barbearias · Master" };

type Row = {
  id: string; slug: string; name: string; phone: string | null;
  subscriptions: { status: string; due_on: string; price_cents: number; plans: { name: string } | null } | null;
};

export default async function ShopsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q = "", status = "" } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("barbershops")
    .select("id, slug, name, phone, subscriptions(status, due_on, price_cents, plans(name))")
    .order("name");
  let rows = (data ?? []) as unknown as Row[];
  const term = q.trim().toLowerCase();
  if (term) rows = rows.filter((r) => r.name.toLowerCase().includes(term) || r.slug.includes(term));
  if (status) rows = rows.filter((r) => r.subscriptions?.status === status);

  return (
    <>
      <PageHead title="Barbearias" sub={`${rows.length} ${rows.length === 1 ? "barbearia" : "barbearias"}`}
        actions={<Link href="/master/barbearias/nova" className="rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-ink hover:brightness-110">Nova barbearia</Link>} />
      <form className="mt-5 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar por nome ou slug" className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3.5 py-2 text-base" />
        <select name="status" defaultValue={status} className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-base">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-surface">Filtrar</button>
      </form>
      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>{["Barbearia", "Plano", "Vencimento", "Valor", "Status"].map((h) => <th key={h} className="p-3 font-normal">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="p-4 text-muted">Nenhuma barbearia encontrada.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="p-3">
                  <Link href={`/master/barbearias/${r.slug}`} className="font-medium hover:text-accent">{r.name}</Link>
                  <p className="text-xs text-muted">/b/{r.slug}</p>
                </td>
                <td className="p-3">{r.subscriptions?.plans?.name ?? "—"}</td>
                <td className="p-3">{dateBR(r.subscriptions?.due_on)}</td>
                <td className="p-3">{r.subscriptions ? brl(r.subscriptions.price_cents) : "—"}</td>
                <td className="p-3">
                  {r.subscriptions ? <span className={`rounded-full border px-2.5 py-0.5 text-xs ${STATUS_TONE[r.subscriptions.status]}`}>{STATUS_LABEL[r.subscriptions.status]}</span> : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
