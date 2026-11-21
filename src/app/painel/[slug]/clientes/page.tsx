import type { Metadata } from "next";
import { saveShopPolicy, toggleCustomerBlock } from "@/app/actions/shop";
import { requireShopAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadFlags } from "@/lib/staff-data";
import { ActionForm, inputCls, L } from "@/components/master-forms";
import { Empty, PageHead, Panel } from "@/components/kit";

export const metadata: Metadata = { title: "Clientes" };

export default async function CustomersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { barbershop } = await requireShopAccess(slug, ["owner"]);
  const supabase = await createClient();
  const [{ data: policy }, { data: custs }] = await Promise.all([
    supabase.from("barbershops").select("cancel_min_hours, no_show_limit").eq("id", barbershop.id).single(),
    supabase.from("customers").select("id, full_name, phone, booking_blocked").eq("barbershop_id", barbershop.id).order("full_name").limit(500),
  ]);
  const list = custs ?? [];
  const flags = await loadFlags(supabase, barbershop.id, list.map((c) => c.id));
  const rows = list.map((c) => ({ ...c, no_shows: flags.get(c.id)?.no_shows ?? 0 }))
    .sort((a, b) => Number(b.booking_blocked) - Number(a.booking_blocked) || b.no_shows - a.no_shows || a.full_name.localeCompare(b.full_name, "pt-BR"));
  const limit = policy?.no_show_limit as number | null | undefined;

  return (
    <>
      <PageHead title="Clientes" sub="Quem faltou, quem está bloqueado e as regras de cancelamento." />
      <Panel title="Regras de agendamento" sub="Valem para quem agenda pelo site. Atendimentos que a equipe cria continuam livres.">
        <ActionForm action={saveShopPolicy} submit="Salvar regras" pending="Salvando…" className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="slug" value={slug} />
          <L label="Cancelar ou remarcar até quantas horas antes?">
            <input key={`h${policy?.cancel_min_hours}`} name="hours" type="number" min={0} max={72} required defaultValue={policy?.cancel_min_hours ?? 2} className={inputCls} />
          </L>
          <L label="Bloquear agendamento online após quantas faltas em 90 dias? (vazio = não bloquear)">
            <input key={`l${limit ?? ""}`} name="limit" type="number" min={1} max={20} defaultValue={limit ?? ""} placeholder="Desligado" className={inputCls} />
          </L>
          <p className="text-xs text-muted sm:col-span-2">Quem passa do limite vê uma mensagem pedindo para falar com a barbearia pelo WhatsApp. Você pode liberar a qualquer momento na lista abaixo. Cancelar com antecedência não conta como falta.</p>
        </ActionForm>
      </Panel>

      <div className="mt-4">
        <Panel title="Lista de clientes" sub={`${rows.length} ${rows.length === 1 ? "cliente" : "clientes"} · faltas contadas nos últimos 90 dias`}>
          {rows.length === 0 ? <Empty>Os clientes aparecem aqui depois do primeiro agendamento.</Empty> : (
            <ul className="divide-y divide-line">
              {rows.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.full_name}</p>
                    <p className="text-xs text-muted">{c.phone || "sem WhatsApp"}</p>
                  </div>
                  <span className={`text-sm ${c.no_shows > 0 ? "text-warn" : "text-muted"}`}>{c.no_shows} {c.no_shows === 1 ? "falta" : "faltas"}</span>
                  {c.booking_blocked ? <span className="rounded-md border border-danger/30 bg-danger-bg px-2 py-0.5 text-xs text-danger">bloqueado online</span> : null}
                  <form action={toggleCustomerBlock}>
                    <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={c.id} /><input type="hidden" name="block" value={c.booking_blocked ? "0" : "1"} />
                    <button className="min-h-10 rounded-lg border border-line px-3 text-sm hover:bg-surface-2">{c.booking_blocked ? "Liberar" : "Bloquear online"}</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
