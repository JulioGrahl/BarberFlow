import type { Metadata } from "next";
import { saveService } from "@/app/actions/shop";
import { ActionForm, inputCls, L } from "@/components/master-forms";
import { requireShopAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { brl } from "@/lib/format";

export const metadata: Metadata = { title: "Serviços" };
const price = (c: number) => (c / 100).toFixed(2).replace(".", ",");

export default async function ServicesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { barbershop } = await requireShopAccess(slug, ["owner"]);
  const supabase = await createClient();
  const { data } = await supabase.from("services").select("id, name, description, price_cents, duration_minutes, active").eq("barbershop_id", barbershop.id).order("name");
  return (
    <>
      <h1 className="text-2xl font-semibold">Serviços</h1>
      <p className="mt-1 text-sm text-muted">Serviços não são apagados: desative para esconder dos clientes e manter o histórico.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {(data ?? []).map((sv) => (
          <div key={sv.id} className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-sm text-muted">{sv.active ? "Ativo" : "Inativo"} · {brl(sv.price_cents)} · {sv.duration_minutes} min</p>
            <ActionForm action={saveService} submit="Salvar" className="mt-3 space-y-3">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="id" value={sv.id} />
              <L label="Nome"><input name="name" defaultValue={sv.name} required className={inputCls} /></L>
              <div className="grid grid-cols-2 gap-3">
                <L label="Preço (R$)"><input name="price" defaultValue={price(sv.price_cents)} inputMode="decimal" required className={inputCls} /></L>
                <L label="Duração (min)"><input name="minutes" type="number" min={5} max={480} defaultValue={sv.duration_minutes} required className={inputCls} /></L>
              </div>
              <L label="Descrição (opcional)"><input name="description" defaultValue={sv.description ?? ""} className={inputCls} /></L>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={sv.active} /> Ativo</label>
            </ActionForm>
          </div>
        ))}
        <div className="rounded-2xl border border-dashed border-line p-4">
          <p className="text-sm font-semibold">Novo serviço</p>
          <ActionForm action={saveService} submit="Criar serviço" className="mt-3 space-y-3">
            <input type="hidden" name="slug" value={slug} />
            <L label="Nome"><input name="name" required placeholder="Corte" className={inputCls} /></L>
            <div className="grid grid-cols-2 gap-3">
              <L label="Preço (R$)"><input name="price" inputMode="decimal" required placeholder="40,00" className={inputCls} /></L>
              <L label="Duração (min)"><input name="minutes" type="number" min={5} max={480} required defaultValue={30} className={inputCls} /></L>
            </div>
            <L label="Descrição (opcional)"><input name="description" className={inputCls} /></L>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked /> Ativo</label>
          </ActionForm>
        </div>
      </div>
    </>
  );
}
