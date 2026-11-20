import type { Metadata } from "next";
import { savePlan } from "@/app/actions/master";
import { ActionForm, inputCls, L } from "@/components/master-forms";
import { createClient } from "@/lib/supabase/server";
import { brl } from "@/lib/format";

export const metadata: Metadata = { title: "Planos · Master" };

const price = (c: number) => (c / 100).toFixed(2).replace(".", ",");

export default async function PlansPage() {
  const supabase = await createClient();
  const { data: plans } = await supabase.from("plans").select("id, name, price_cents, max_professionals, active").order("price_cents");
  return (
    <>
      <h1 className="text-2xl font-semibold">Planos</h1>
      <p className="mt-1 text-sm text-muted">Planos não são apagados: desative para esconder de novas barbearias. Alterar o preço aqui não muda assinaturas existentes.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {(plans ?? []).map((p) => (
          <div key={p.id} className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-sm text-muted">{p.active ? "Ativo" : "Inativo"} · atual {brl(p.price_cents)}</p>
            <ActionForm action={savePlan} submit="Salvar" className="mt-3 space-y-3">
              <input type="hidden" name="id" value={p.id} />
              <L label="Nome"><input name="name" defaultValue={p.name} required className={inputCls} /></L>
              <div className="grid grid-cols-2 gap-3">
                <L label="Preço mensal (R$)"><input name="price" defaultValue={price(p.price_cents)} inputMode="decimal" required className={inputCls} /></L>
                <L label="Máx. profissionais"><input name="max" type="number" min={1} defaultValue={p.max_professionals ?? ""} placeholder="ilimitado" className={inputCls} /></L>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={p.active} /> Ativo</label>
            </ActionForm>
          </div>
        ))}
        <div className="rounded-2xl border border-dashed border-line p-4">
          <p className="text-sm font-semibold">Novo plano</p>
          <ActionForm action={savePlan} submit="Criar plano" className="mt-3 space-y-3">
            <L label="Nome"><input name="name" required className={inputCls} /></L>
            <div className="grid grid-cols-2 gap-3">
              <L label="Preço mensal (R$)"><input name="price" inputMode="decimal" required placeholder="49,90" className={inputCls} /></L>
              <L label="Máx. profissionais"><input name="max" type="number" min={1} placeholder="ilimitado" className={inputCls} /></L>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked /> Ativo</label>
          </ActionForm>
        </div>
      </div>
    </>
  );
}
