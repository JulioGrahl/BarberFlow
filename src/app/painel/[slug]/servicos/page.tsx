import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { saveService } from "@/app/actions/shop";
import { ActionForm, inputCls, L } from "@/components/master-forms";
import { Drawer } from "@/components/drawer";
import { Empty, PageHead } from "@/components/kit";
import { requireShopAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { brl } from "@/lib/format";

export const metadata: Metadata = { title: "Serviços" };
const price = (c: number) => (c / 100).toFixed(2).replace(".", ",");

function ServiceForm({ slug, sv }: { slug: string; sv?: { id: string; name: string; description: string | null; price_cents: number; duration_minutes: number; active: boolean } }) {
  return (
    <ActionForm action={saveService} submit={sv ? "Salvar alterações" : "Criar serviço"} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      {sv ? <input type="hidden" name="id" value={sv.id} /> : null}
      <L label="Nome"><input name="name" defaultValue={sv?.name} required placeholder="Corte" className={inputCls} /></L>
      <div className="grid grid-cols-2 gap-3">
        <L label="Preço (R$)"><input name="price" defaultValue={sv ? price(sv.price_cents) : ""} inputMode="decimal" required placeholder="40,00" className={inputCls} /></L>
        <L label="Duração (min)"><input name="minutes" type="number" min={5} max={480} defaultValue={sv?.duration_minutes ?? 30} required className={inputCls} /></L>
      </div>
      <L label="Descrição (opcional)"><input name="description" defaultValue={sv?.description ?? ""} className={inputCls} /></L>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={sv?.active ?? true} /> Visível para os clientes</label>
    </ActionForm>
  );
}

export default async function ServicesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { barbershop } = await requireShopAccess(slug, ["owner"]);
  const supabase = await createClient();
  const { data } = await supabase.from("services").select("id, name, description, price_cents, duration_minutes, active").eq("barbershop_id", barbershop.id).order("active", { ascending: false }).order("price_cents");
  const list = data ?? [];
  return (
    <>
      <PageHead title="Serviços" sub="Serviços não são apagados: desative para esconder dos clientes e manter o histórico."
        actions={<Drawer title="Novo serviço" trigger={<><Plus size={16} aria-hidden /> Novo serviço</>}><ServiceForm slug={slug} /></Drawer>} />
      {list.length === 0 ? <Empty>Nenhum serviço ainda. Crie o primeiro para liberar agendamentos na página pública.</Empty> : (
        <div className="max-w-2xl rounded-xl border border-line bg-surface px-5 py-2">
          <ul className="divide-y divide-line">
            {list.map((sv) => (
              <li key={sv.id}>
                <Drawer title={sv.name} triggerClassName={`group flex w-full items-baseline gap-3 py-4 text-left ${sv.active ? "" : "opacity-50"}`}
                  trigger={
                    <>
                      <span className="min-w-0">
                        <span className="font-display text-xl group-hover:text-accent">{sv.name}</span>
                        <span className="block text-xs text-muted">{sv.duration_minutes} min{sv.description ? ` · ${sv.description}` : ""}{sv.active ? "" : " · oculto"}</span>
                      </span>
                      <span className="mb-1.5 min-w-6 flex-1 self-end border-b border-dotted border-line" aria-hidden />
                      <span className="font-display text-xl">{brl(sv.price_cents)}</span>
                    </>
                  }>
                  <ServiceForm slug={slug} sv={sv} />
                </Drawer>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
