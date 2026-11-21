import type { Metadata } from "next";
import Link from "next/link";
import { saveHours } from "@/app/actions/shop";
import { ActionForm } from "@/components/master-forms";
import { requireShopAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { WEEKDAYS } from "@/lib/format";

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
  const byDay = new Map((rows ?? []).map((r) => [r.weekday, r]));
  const tab = (active: boolean) => `rounded-xl border px-3.5 py-2 text-sm ${active ? "border-accent bg-accent/10 text-accent" : "border-line hover:bg-surface"}`;
  const time = "rounded-xl border border-line bg-surface-2 px-2.5 py-2 text-base";

  return (
    <>
      <h1 className="text-2xl font-semibold">Horários</h1>
      <p className="mt-1 text-sm text-muted">
        Defina o funcionamento da barbearia. Se um profissional tiver horário próprio em um dia, vale o período em comum com o da barbearia; sem horário próprio, vale o da barbearia.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={`/painel/${slug}/horarios`} className={tab(!current)}>Barbearia</Link>
        {(pros ?? []).map((p) => <Link key={p.id} href={`/painel/${slug}/horarios?pro=${p.id}`} className={tab(current?.id === p.id)}>{p.display_name}</Link>)}
      </div>
      <ActionForm key={current?.id ?? "shop"} action={saveHours} submit="Salvar horários" className="mt-6 space-y-3">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="pro" value={current?.id ?? ""} />
        {WEEKDAYS.map((name, d) => {
          const r = byDay.get(d);
          return (
            <div key={d} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-3">
              <label className="flex w-32 items-center gap-2 text-sm"><input type="checkbox" name={`on_${d}`} defaultChecked={!!r} /> {name}</label>
              <input type="time" name={`start_${d}`} defaultValue={hm(r?.start_time) || "09:00"} className={time} aria-label={`${name}: abertura`} />
              <span className="text-muted">às</span>
              <input type="time" name={`end_${d}`} defaultValue={hm(r?.end_time) || "18:00"} className={time} aria-label={`${name}: fechamento`} />
              <span className="ml-2 text-xs text-muted">Intervalo</span>
              <input type="time" name={`bs_${d}`} defaultValue={hm(r?.break_start)} className={time} aria-label={`${name}: início do intervalo`} />
              <span className="text-muted">–</span>
              <input type="time" name={`be_${d}`} defaultValue={hm(r?.break_end)} className={time} aria-label={`${name}: fim do intervalo`} />
            </div>
          );
        })}
      </ActionForm>
    </>
  );
}
