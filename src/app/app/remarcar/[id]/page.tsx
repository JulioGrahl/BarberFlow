import type { Metadata } from "next";
import Link from "next/link";
import { PublicTop } from "@/components/public-shell";
import { notFound, redirect } from "next/navigation";
import * as z from "zod";
import { rescheduleMyBooking } from "@/app/actions/booking";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dayMonth, fullDateTimeBR, nextDays, nowMs, timeBR, weekdayShort } from "@/lib/format";

export const metadata: Metadata = { title: "Remarcar horário" };

type Appt = {
  id: string; starts_at: string; status: string; barbershop_id: string; professional_id: string; service_id: string;
  services: { name: string } | null; professionals: { display_name: string } | null; barbershops: { name: string; cancel_min_hours: number } | null;
};

export default async function ReschedulePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ dia?: string }> }) {
  const { id } = await params;
  const { dia } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await requireUser(`/app/remarcar/${id}`);
  const supabase = await createClient();
  // Só o próprio cliente remarca o próprio horário (o banco confere de novo).
  const { data: mine } = await supabase.from("customers").select("id").eq("profile_id", user.id);
  const ids = (mine ?? []).map((c) => c.id);
  const { data } = ids.length === 0 ? { data: null } : await supabase.from("appointments")
    .select("id, starts_at, status, barbershop_id, professional_id, service_id, services(name), professionals(display_name), barbershops(name, cancel_min_hours)")
    .eq("id", id).in("customer_id", ids).maybeSingle();
  const a = data as unknown as Appt | null;
  if (!a || a.status !== "scheduled") redirect("/app");

  const minH = a.barbershops?.cancel_min_hours ?? 0;
  const tooLate = new Date(a.starts_at).getTime() - minH * 3600e3 < nowMs();
  const days = nextDays(14);
  const day = dia && days.includes(dia) ? dia : days[0];
  const { data: slots } = tooLate ? { data: [] } : await supabase.rpc("get_available_slots", { p_shop: a.barbershop_id, p_professional: a.professional_id, p_service: a.service_id, p_day: day });
  const list = ((slots ?? []) as { starts_at: string }[]).map((s) => s.starts_at);

  return (
    <div className="flex-1"><PublicTop wide title="Remarcar horário" kicker={a.barbershops?.name} back={{ href: "/app", label: "Minha conta" }} /><main className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8">
      <p className="text-sm text-muted">{a.services?.name} com {a.professionals?.display_name} · {a.barbershops?.name}</p>
      <p className="text-sm text-muted">Horário atual: <span className="text-ink">{fullDateTimeBR(a.starts_at)}</span></p>

      {tooLate ? (
        <p role="alert" className="mt-6 rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-sm text-danger">O prazo para remarcar já passou ({minH} h antes do horário). Fale com a barbearia.</p>
      ) : (
        <>
          <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-8">
          <nav aria-label="Dia" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:content-start lg:overflow-visible lg:px-0">
            {days.map((d) => (
              <Link key={d} href={`/app/remarcar/${id}?dia=${d}`} aria-current={d === day ? "date" : undefined}
                className={`min-w-14 shrink-0 rounded-lg border px-2 py-2 text-center lg:min-w-0 ${d === day ? "border-night bg-night text-night-ink" : "border-line bg-surface hover:border-line-strong"}`}>
                <span className={`block text-xs ${d === day ? "text-night-muted" : "text-muted"}`}>{weekdayShort(d)}</span><span className="font-display block text-2xl leading-tight">{d.slice(8)}</span><span className={`block text-[10px] ${d === day ? "text-night-muted" : "text-muted"}`}>{dayMonth(d).slice(3)}</span>
              </Link>
            ))}
          </nav>
          {list.length === 0 ? (
            <p className="mt-4 self-start rounded-lg border border-dashed border-line-strong bg-surface px-4 py-6 text-center text-sm text-muted lg:mt-0">Sem horários livres neste dia. Escolha outro dia.</p>
          ) : (
            <form action={rescheduleMyBooking} className="mt-4 lg:mt-0">
              <input type="hidden" name="id" value={a.id} />
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
                {list.map((iso) => (
                  <button key={iso} name="at" value={iso} className="font-display min-h-12 rounded-lg border border-line-strong bg-surface text-xl hover:border-night hover:bg-night hover:text-white">{timeBR(iso)}</button>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted">Ao tocar em um horário, o agendamento é remarcado na hora.</p>
            </form>
          )}
          </div>
        </>
      )}
    </main></div>
  );
}
