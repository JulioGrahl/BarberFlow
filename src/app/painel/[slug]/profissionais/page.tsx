import type { Metadata } from "next";
import { inviteBarber, revokeInvite, saveProfessional } from "@/app/actions/shop";
import { ActionForm, inputCls, L } from "@/components/master-forms";
import { requireShopAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dateBR } from "@/lib/format";

export const metadata: Metadata = { title: "Profissionais" };

export default async function ProfessionalsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { barbershop } = await requireShopAccess(slug, ["owner"]);
  const supabase = await createClient();
  const [pros, services, links, commissions, invites] = await Promise.all([
    supabase.from("professionals").select("id, display_name, active").eq("barbershop_id", barbershop.id).order("display_name"),
    supabase.from("services").select("id, name").eq("barbershop_id", barbershop.id).eq("active", true).order("name"),
    supabase.from("professional_services").select("professional_id, service_id").eq("barbershop_id", barbershop.id),
    supabase.from("professional_commissions").select("professional_id, percent").eq("barbershop_id", barbershop.id),
    supabase.from("invitations").select("id, professional_id, email, expires_at").eq("barbershop_id", barbershop.id).eq("role", "barber").is("accepted_at", null).is("revoked_at", null).gt("expires_at", new Date().toISOString()),
  ]);
  const svc = services.data ?? [];
  const linked = (pid: string) => new Set((links.data ?? []).filter((l) => l.professional_id === pid).map((l) => l.service_id));
  const pct = (pid: string) => String((commissions.data ?? []).find((c) => c.professional_id === pid)?.percent ?? 0).replace(".", ",");

  const fields = (pid?: string) => (
    <>
      <input type="hidden" name="slug" value={slug} />
      {pid ? <input type="hidden" name="id" value={pid} /> : null}
    </>
  );
  const serviceBoxes = (pid?: string) => {
    const set = pid ? linked(pid) : new Set<string>();
    return (
      <fieldset className="space-y-1.5">
        <legend className="text-sm text-muted">Serviços que realiza</legend>
        {svc.length === 0 ? <p className="text-xs text-muted">Cadastre serviços antes.</p> : svc.map((s) => (
          <label key={s.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="services" value={s.id} defaultChecked={set.has(s.id)} /> {s.name}</label>
        ))}
      </fieldset>
    );
  };

  return (
    <>
      <h1 className="text-2xl font-semibold">Profissionais</h1>
      <p className="mt-1 text-sm text-muted">Cadastre o profissional, escolha os serviços e, se ele for usar o sistema, envie um convite para criar a conta dele.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {(pros.data ?? []).map((p) => {
          const pending = (invites.data ?? []).filter((i) => i.professional_id === p.id);
          return (
            <div key={p.id} className="space-y-4 rounded-2xl border border-line bg-surface p-4">
              <ActionForm action={saveProfessional} submit="Salvar" className="space-y-3">
                {fields(p.id)}
                <L label="Nome"><input name="name" defaultValue={p.display_name} required className={inputCls} /></L>
                <L label="Comissão (%)"><input name="percent" defaultValue={pct(p.id)} inputMode="decimal" className={inputCls} /></L>
                {serviceBoxes(p.id)}
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={p.active} /> Ativo</label>
              </ActionForm>
              <div className="border-t border-line pt-3">
                <p className="text-sm font-semibold">Acesso ao sistema</p>
                {pending.map((i) => (
                  <form key={i.id} action={revokeInvite} className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="id" value={i.id} />
                    <span>Convite pendente{i.email ? ` para ${i.email}` : ""} até {dateBR(i.expires_at)}</span>
                    <button className="rounded-lg border border-line px-2.5 py-1 hover:bg-surface-2">Revogar</button>
                  </form>
                ))}
                <ActionForm action={inviteBarber} submit="Gerar convite" className="mt-3 space-y-3">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="professional" value={p.id} />
                  <L label="E-mail do barbeiro (opcional)"><input name="email" type="email" className={inputCls} /></L>
                </ActionForm>
              </div>
            </div>
          );
        })}
        <div className="rounded-2xl border border-dashed border-line p-4">
          <p className="text-sm font-semibold">Novo profissional</p>
          <ActionForm action={saveProfessional} submit="Adicionar" className="mt-3 space-y-3">
            {fields()}
            <L label="Nome"><input name="name" required className={inputCls} /></L>
            <L label="Comissão (%)"><input name="percent" defaultValue="0" inputMode="decimal" className={inputCls} /></L>
            {serviceBoxes()}
          </ActionForm>
        </div>
      </div>
    </>
  );
}
