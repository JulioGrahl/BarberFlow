import type { Metadata } from "next";
import Link from "next/link";
import { createBarbershop } from "@/app/actions/master";
import { ActionForm, inputCls, L } from "@/components/master-forms";
import { createClient } from "@/lib/supabase/server";
import { brl, isoDateIn } from "@/lib/format";

export const metadata: Metadata = { title: "Nova Barbearia · Master" };

export default async function NewShopPage() {
  const supabase = await createClient();
  const { data: plans } = await supabase.from("plans").select("id, name, price_cents").eq("active", true).order("price_cents");
  const due = isoDateIn(30);
  return (
    <div className="max-w-xl">
      <Link href="/master/barbearias" className="text-sm text-muted hover:text-ink">← Barbearias</Link>
      <h1 className="mt-2 text-2xl font-semibold">Nova Barbearia</h1>
      {plans?.length ? (
        <ActionForm action={createBarbershop} submit="Criar barbearia" pending="Criando..." className="mt-6 space-y-4">
          <L label="Nome da barbearia"><input name="name" required minLength={2} className={inputCls} /></L>
          <L label="Endereço (slug) — ex.: barbearia-central"><input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={3} maxLength={60} className={inputCls} /></L>
          <L label="Nome do proprietário"><input name="ownerName" required minLength={3} className={inputCls} /></L>
          <L label="E-mail do proprietário"><input name="ownerEmail" type="email" required className={inputCls} /></L>
          <L label="Telefone da barbearia (opcional)"><input name="phone" type="tel" className={inputCls} /></L>
          <L label="Plano">
            <select name="planId" required className={inputCls}>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name} — {brl(p.price_cents)}</option>)}
            </select>
          </L>
          <L label="Primeiro vencimento"><input name="dueOn" type="date" required defaultValue={due} className={inputCls} /></L>
        </ActionForm>
      ) : (
        <p className="mt-6 rounded-lg border border-warn/40 p-4 text-sm text-warn">
          Cadastre ao menos um plano ativo em <Link className="underline" href="/master/planos">Planos</Link> antes de criar barbearias.
        </p>
      )}
    </div>
  );
}
