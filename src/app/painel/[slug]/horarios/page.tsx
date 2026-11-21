import type { Metadata } from "next";
import Link from "next/link";
import { addBlock, deleteBlock, saveHours } from "@/app/actions/shop";
import { Plus } from "lucide-react";
import { Drawer } from "@/components/drawer";
import { ClearBreak } from "@/components/clear-break";
import { ActionForm, inputCls, L } from "@/components/master-forms";
import { requireShopAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dayMonth, nextDays, nowISO, spParts, timeBR, WEEKDAYS } from "@/lib/format";
import { Empty, PageHead, Panel } from "@/components/kit";

export const metadata: Metadata = { title: "Horários" };
const hm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

export default async function HoursPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ pro?: string }> }) {
  const { slug } = await params;
  const { pro } = await searchParams;
  const { barbershop } = await requireShopAccess(slug, ["owner"]);
  const supabase = await createClient();
  const { data: pros } = await supabase.from("professionals").select("id, display_name").eq("barbershop_id", barbershop.id).eq("active", true).order("display_name");
  const current = (pros ?? []).find((p) => p.id === pro);
  const q = supabase.from("schedules").select("weekday, start_time, end_time, break_start, break_end").eq("barbershop_id", barbershop.id);
  const { data: rows } = await (current ? q.eq("professional_id", current.id) : q.is("professional_id", null));
  const { data: blocksData } = await supabase.from("blocked_times").select("id, professional_id, starts_at, ends_at, reason").eq("barbershop_id", barbershop.id).gte("ends_at", nowISO()).order("starts_at").limit(50);
  const blocks = blocksData ?? [];
  const proName = new Map((pros ?? []).map((p) => [p.id, p.display_name]));
  const today = nextDays(1)[0];
  const byDay = new Map((rows ?? []).map((r) => [r.weekday, r]));
  const time = "w-[7rem] rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-base";

  return (
    <>
      <PageHead title="Horários" sub="Funcionamento da barbearia e, se precisar, horário próprio de cada profissional (vale o período em comum com o da barbearia)." />
      <div className="mb-5 inline-flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1">
        {[{ id: "", display_name: "Barbearia" }, ...(pros ?? [])].map((p) => (
          <Link key={p.id} href={p.id ? `/painel/${slug}/horarios?pro=${p.id}` : `/painel/${slug}/horarios`}
            className={`rounded-md px-3 py-1.5 text-sm ${(current?.id ?? "") === p.id ? "bg-surface-2 text-accent" : "text-muted hover:text-ink"}`}>{p.display_name}</Link>
        ))}
      </div>
      <ActionForm key={current?.id ?? "shop"} action={saveHours} submit="Salvar horários" className="max-w-3xl space-y-4">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="pro" value={current?.id ?? ""} />
        <div className="divide-y divide-line rounded-xl border border-line bg-surface">
          {WEEKDAYS.map((name, d) => {
            const r = byDay.get(d);
            return (
              <div key={d} className="group flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 has-[input[type=checkbox]:not(:checked)]:text-muted">
                <label className="flex w-32 cursor-pointer items-center gap-2.5 text-sm font-medium"><input type="checkbox" name={`on_${d}`} defaultChecked={!!r} className="size-4 accent-[var(--bf-accent)]" /> {name}</label>
                <div className="flex items-center gap-2 group-has-[input[type=checkbox]:not(:checked)]:opacity-40">
                  <input type="time" name={`start_${d}`} defaultValue={hm(r?.start_time) || "09:00"} className={time} aria-label={`${name}: abertura`} />
                  <span className="text-muted">às</span>
                  <input type="time" name={`end_${d}`} defaultValue={hm(r?.end_time) || "18:00"} className={time} aria-label={`${name}: fechamento`} />
                </div>
                <div className="flex items-center gap-2 text-xs group-has-[input[type=checkbox]:not(:checked)]:opacity-40">
                  <span className="text-muted">intervalo</span>
                  <input type="time" name={`bs_${d}`} defaultValue={hm(r?.break_start)} className={time} aria-label={`${name}: início do intervalo`} />
                  <span className="text-muted">–</span>
                  <input type="time" name={`be_${d}`} defaultValue={hm(r?.break_end)} className={time} aria-label={`${name}: fim do intervalo`} />
                  <ClearBreak day={d} />
                </div>
              </div>
            );
          })}
        </div>
      </ActionForm>

      <Panel className="mt-8 max-w-3xl" title="Folgas e feriados" sub="Dias ou horários em que não se atende, além da rotina semanal. Clientes não conseguem agendar nesses períodos."
        aside={
          <Drawer title="Nova folga" trigger={<><Plus size={16} aria-hidden /> Adicionar</>}>
            <ActionForm action={addBlock} submit="Salvar bloqueio" className="space-y-4">
              <input type="hidden" name="slug" value={slug} />
              <L label="Vale para">
                <select name="pro" className={inputCls} defaultValue={current?.id ?? ""}>
                  <option value="">Toda a barbearia</option>
                  {(pros ?? []).map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
                </select>
              </L>
              <div className="grid grid-cols-2 gap-3">
                <L label="De"><input type="date" name="from" required min={today} className={inputCls} /></L>
                <L label="Até (opcional)"><input type="date" name="to" min={today} className={inputCls} /></L>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="all_day" defaultChecked className="size-4 accent-[var(--bf-accent)]" /> Dia inteiro</label>
              <div className="grid grid-cols-2 gap-3">
                <L label="Início (se não for dia inteiro)"><input type="time" name="start" className={inputCls} /></L>
                <L label="Fim"><input type="time" name="end" className={inputCls} /></L>
              </div>
              <L label="Motivo (opcional)"><input name="reason" placeholder="Feriado, consulta, férias…" className={inputCls} /></L>
            </ActionForm>
          </Drawer>
        }>
        {blocks.length === 0 ? <Empty>Nenhuma folga ou feriado cadastrado.</Empty> : (
          <ul className="divide-y divide-line text-sm">
            {blocks.map((b) => {
              const a = spParts(b.starts_at), z = spParts(new Date(new Date(b.ends_at).getTime() - 1).toISOString());
              const full = a.hour === 0 && timeBR(b.starts_at) === "00:00" && timeBR(b.ends_at) === "00:00";
              const when = full ? (a.ymd === z.ymd ? dayMonth(a.ymd) : `${dayMonth(a.ymd)} a ${dayMonth(z.ymd)}`) : `${dayMonth(a.ymd)}, ${timeBR(b.starts_at)} às ${timeBR(b.ends_at)}`;
              return (
                <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                  <span>
                    <span className="block font-medium">{when}{full ? " · dia inteiro" : ""}</span>
                    <span className="text-xs text-muted">{b.professional_id ? proName.get(b.professional_id) ?? "Profissional" : "Toda a barbearia"}{b.reason ? ` · ${b.reason}` : ""}</span>
                  </span>
                  <form action={deleteBlock}>
                    <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={b.id} />
                    <button className="rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-danger">Remover</button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
