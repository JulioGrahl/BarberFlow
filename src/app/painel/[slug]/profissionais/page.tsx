import type { Metadata } from "next";
import { inviteBarber, revokeInvite, saveProfessional } from "@/app/actions/shop";
import { ActionForm, inputCls, L } from "@/components/master-forms";
import { requireShopAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { nowISO, tsDateBR } from "@/lib/format";
import { Plus } from "lucide-react";
import { Drawer } from "@/components/drawer";
import { Empty, PageHead } from "@/components/kit";

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
    supabase.from("invitations").select("id, professional_id, email, expires_at").eq("barbershop_id", barbershop.id).eq("role", "barber").is("accepted_at", null).is("revoked_at", null).gt("expires_at", nowISO()),
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

  const list = pros.data ?? [];
  return (
    <>
      <PageHead title="Equipe" sub="Cada profissional tem comissão, serviços próprios e, se quiser, acesso individual ao sistema por convite."
        actions={
          <Drawer title="Novo profissional" trigger={<><Plus size={16} aria-hidden /> Adicionar</>}>
            <ActionForm action={saveProfessional} submit="Adicionar profissional" className="space-y-4">
              {fields()}
              <L label="Nome"><input name="name" required className={inputCls} /></L>
              <L label="Comissão (%)"><input name="percent" defaultValue="0" inputMode="decimal" className={inputCls} /></L>
              {serviceBoxes()}
            </ActionForm>
          </Drawer>
        } />
      {list.length === 0 ? <Empty>Nenhum profissional ainda. Adicione o primeiro para abrir a agenda.</Empty> : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => {
            const pending = (invites.data ?? []).filter((i) => i.professional_id === p.id);
            const n = linked(p.id).size;
            return (
              <li key={p.id}>
                <Drawer title={p.display_name} triggerClassName={`group flex w-full items-center gap-4 rounded-xl border border-line bg-surface p-4 text-left transition hover:border-accent/50 ${p.active ? "" : "opacity-50"}`}
                  trigger={
                    <>
                      <span className="font-display flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xl text-accent">{p.display_name.slice(0, 1)}</span>
                      <span className="min-w-0">
                        <span className="font-display block truncate text-lg">{p.display_name}</span>
                        <span className="block text-xs text-muted">{pct(p.id)}% de comissão · {n} {n === 1 ? "serviço" : "serviços"}</span>
                        {pending.length ? <span className="mt-1 block text-xs text-warn">convite pendente</span> : null}
                      </span>
                    </>
                  }>
                  <div className="space-y-6">
                    <ActionForm action={saveProfessional} submit="Salvar alterações" className="space-y-4">
                      {fields(p.id)}
                      <L label="Nome"><input name="name" defaultValue={p.display_name} required className={inputCls} /></L>
                      <L label="Comissão (%)"><input name="percent" defaultValue={pct(p.id)} inputMode="decimal" className={inputCls} /></L>
                      {serviceBoxes(p.id)}
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={p.active} /> Ativo na agenda</label>
                    </ActionForm>
                    <div className="border-t border-line pt-5">
                      <h3 className="font-display text-lg">Acesso ao sistema</h3>
                      <p className="mb-3 text-xs text-muted">O barbeiro cria a própria conta pelo convite e passa a ver a agenda e os ganhos dele.</p>
                      {pending.map((i) => (
                        <form key={i.id} action={revokeInvite} className="mb-3 flex items-center justify-between gap-2 text-xs text-muted">
                          <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={i.id} />
                          <span>Convite pendente{i.email ? ` para ${i.email}` : ""} até {tsDateBR(i.expires_at)}</span>
                          <button className="rounded-md border border-line px-2.5 py-1 hover:bg-surface-2">Revogar</button>
                        </form>
                      ))}
                      <ActionForm action={inviteBarber} submit="Gerar convite" className="space-y-3">
                        <input type="hidden" name="slug" value={slug} /><input type="hidden" name="professional" value={p.id} />
                        <L label="E-mail do barbeiro (opcional)"><input name="email" type="email" className={inputCls} /></L>
                      </ActionForm>
                    </div>
                  </div>
                </Drawer>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
