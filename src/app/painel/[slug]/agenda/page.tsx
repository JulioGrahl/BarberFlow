import type { Metadata } from "next";
import Link from "next/link";
import { setAppointmentStatus } from "@/app/actions/shop";
import { getUser, requireShopAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { brl, canClose, longDate, nextDays, nextQuarter, spParts, timeBR, weekdayShort } from "@/lib/format";
import { loadFlags, loadStaffPros } from "@/lib/staff-data";
import { WalkInButton } from "@/components/walkin-form";
import { RescheduleButton } from "@/components/reschedule-form";
import { Empty, PageHead } from "@/components/kit";
import { Check, ChevronLeft, ChevronRight, UserX, X } from "lucide-react";

export const metadata: Metadata = { title: "Agenda" };

type Row = {
  id: string; starts_at: string; ends_at: string; status: string; price_cents: number; customer_id: string; service_id: string; professional_id: string;
  customers: { full_name: string; phone: string | null } | null;
  services: { name: string } | null;
  professionals: { display_name: string } | null;
};
const STATUS: Record<string, [string, string, string]> = {
  scheduled: ["Agendado", "bg-blue", "text-blue"],
  completed: ["Concluído", "bg-success", "text-success"],
  no_show: ["Faltou", "bg-warn", "text-warn"],
  cancelled: ["Cancelado", "bg-line", "text-muted"],
};
const addDays = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

export default async function AgendaPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ dia?: string; pro?: string; erro?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { role, barbershop } = await requireShopAccess(slug);
  const today = nextDays(1)[0];
  const day = sp.dia && /^\d{4}-\d{2}-\d{2}$/.test(sp.dia) ? sp.dia : today;
  // America/Sao_Paulo não tem horário de verão desde 2019: UTC-3 fixo.
  const from = new Date(`${day}T00:00:00-03:00`).toISOString();
  const to = new Date(`${addDays(day, 1)}T00:00:00-03:00`).toISOString();
  const week = Array.from({ length: 7 }, (_, i) => addDays(day, i - 3));

  const supabase = await createClient();
  let q = supabase
    .from("appointments")
    .select("id, starts_at, ends_at, status, price_cents, customer_id, service_id, professional_id, customers(full_name, phone), services(name), professionals(display_name)")
    .eq("barbershop_id", barbershop.id).gte("starts_at", from).lt("starts_at", to).order("starts_at");
  if (role === "owner" && sp.pro) q = q.eq("professional_id", sp.pro);
  let wq = supabase.from("appointments").select("starts_at").eq("barbershop_id", barbershop.id).neq("status", "cancelled")
    .gte("starts_at", new Date(`${week[0]}T00:00:00-03:00`).toISOString()).lt("starts_at", new Date(`${addDays(week[6], 1)}T00:00:00-03:00`).toISOString());
  if (role === "owner" && sp.pro) wq = wq.eq("professional_id", sp.pro);
  const [{ data }, { data: wk }, pros] = await Promise.all([
    q, wq,
    role === "owner" ? supabase.from("professionals").select("id, display_name").eq("barbershop_id", barbershop.id).eq("active", true).order("display_name") : Promise.resolve({ data: [] }),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const user = await getUser();
  const [staffPros, flags] = await Promise.all([
    loadStaffPros(supabase, barbershop.id, role === "owner", user?.id ?? ""),
    loadFlags(supabase, barbershop.id, rows.filter((r) => r.status === "scheduled").map((r) => r.customer_id)),
  ]);
  const nq = nextQuarter();
  const counts = new Map<string, number>();
  for (const a of wk ?? []) { const d = spParts(a.starts_at as string).ymd; counts.set(d, (counts.get(d) ?? 0) + 1); }
  const total = rows.filter((r) => r.status === "completed").reduce((a, r) => a + r.price_cents, 0);
  const open = rows.filter((r) => r.status === "scheduled").length;
  const base = `/painel/${slug}/agenda`;
  const qs = (d: string) => `${base}?dia=${d}${sp.pro ? `&pro=${sp.pro}` : ""}`;
  const arrow = "rounded-lg border border-line p-2 text-muted hover:bg-surface hover:text-ink";

  return (
    <>
      <PageHead title="Agenda" sub={`${longDate(day)}${day === today ? " · hoje" : ""}`} actions={
        <>
          <Link href={qs(addDays(day, -1))} className={arrow} aria-label="Dia anterior"><ChevronLeft size={18} /></Link>
          {day !== today ? <Link href={qs(today)} className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface">Hoje</Link> : null}
          <Link href={qs(addDays(day, 1))} className={arrow} aria-label="Próximo dia"><ChevronRight size={18} /></Link>
          <WalkInButton slug={slug} pros={staffPros} date={day < nq.date ? nq.date : day} time={day === nq.date || day < nq.date ? nq.time : "09:00"} />
        </>
      } />

      <nav aria-label="Semana" className="mb-5 grid grid-cols-7 gap-1.5">
        {week.map((d) => {
          const on = d === day, n = counts.get(d) ?? 0;
          return (
            <Link key={d} href={qs(d)} aria-current={on ? "date" : undefined}
              className={`rounded-xl border px-1 py-2.5 text-center transition ${on ? "border-night bg-night text-night-ink" : "border-line bg-surface hover:border-line-strong"}`}>
              <span className={`block text-xs ${on ? "text-night-muted" : "text-muted"}`}>{weekdayShort(d)}</span>
              <span className={`font-display block text-2xl leading-tight ${d === today && !on ? "text-accent" : ""}`}>{d.slice(8)}</span>
              <span className="mt-1 flex h-1.5 justify-center gap-0.5">{Array.from({ length: Math.min(n, 5) }, (_, i) => <i key={i} className={`size-1.5 rounded-full ${on ? "bg-flare" : "bg-accent"}`} />)}</span>
            </Link>
          );
        })}
      </nav>

      {role === "owner" && (pros.data ?? []).length > 0 ? (
        <div className="mb-5 inline-flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1">
          {[{ id: "", display_name: "Todos" }, ...(pros.data ?? [])].map((p) => (
            <Link key={p.id} href={p.id ? `${base}?dia=${day}&pro=${p.id}` : `${base}?dia=${day}`}
              className={`rounded-md px-3 py-1.5 text-sm ${(sp.pro ?? "") === p.id ? "bg-night font-medium text-white" : "text-muted hover:text-ink"}`}>{p.display_name}</Link>
          ))}
        </div>
      ) : null}

      {sp.erro ? <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger-bg px-3.5 py-2.5 text-sm text-danger">Não foi possível atualizar o atendimento.</p> : null}
      <p className="mb-4 text-sm text-muted">{rows.length === 0 ? "Sem atendimentos" : `${open} por atender · ${rows.length - open} encerrados`}{role === "owner" && total > 0 ? ` · ${brl(total)} concluídos` : ""}</p>

      {rows.length === 0 ? <Empty>Nenhum atendimento neste dia. Escolha outro dia na faixa acima.</Empty> : (
        <ol className="space-y-2">
          {rows.map((r) => {
            const [label, bar, text] = STATUS[r.status] ?? [r.status, "bg-line", "text-muted"];
            return (
              <li key={r.id} className="flex gap-3">
                <div className="w-14 shrink-0 pt-4 text-right"><p className="font-display text-xl leading-none">{timeBR(r.starts_at)}</p><p className="text-xs tabular-nums text-muted">{timeBR(r.ends_at)}</p></div>
                <div className="relative min-w-0 flex-1 overflow-hidden rounded-xl border border-line bg-surface py-3 pl-5 pr-4">
                  <span className={`absolute inset-y-0 left-0 w-1 ${bar}`} aria-hidden />
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.customers?.full_name ?? "Cliente"}</p>
                      <p className="truncate text-sm text-muted">{r.services?.name}{role === "owner" ? ` · ${r.professionals?.display_name}` : ""} · {brl(r.price_cents)}</p>
                      {r.customers?.phone ? <p className="text-xs text-muted">{r.customers.phone}</p> : null}
                      {r.status === "scheduled" && (flags.get(r.customer_id)?.no_shows || flags.get(r.customer_id)?.blocked) ? (
                        <p className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-warn/30 bg-warn-bg px-2 py-0.5 text-xs text-warn">{flags.get(r.customer_id)!.no_shows} faltas em 90 dias{flags.get(r.customer_id)!.blocked ? " · bloqueado online" : ""}</p>
                      ) : null}
                    </div>
                    {r.status === "scheduled" ? (
                      <div className="flex flex-wrap gap-1.5">
                        <RescheduleButton slug={slug} id={r.id} date={spParts(r.starts_at).ymd} time={timeBR(r.starts_at)} who={r.customers?.full_name ?? "Cliente"} proId={r.professional_id}
                          pros={role === "owner" ? staffPros.filter((x) => x.services.some((sv) => sv.id === r.service_id)).map((x) => ({ id: x.id, name: x.name })) : undefined}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-surface-2" />
                        {([["completed", "Concluir", Check, "bg-night text-white hover:bg-night-2"], ["no_show", "Faltou", UserX, "border border-line hover:bg-surface-2"]] as [string, string, typeof Check, string][])
                          .filter(() => canClose(r.starts_at)).map(([st, text, Icon, cls]) => (
                          <form key={st} action={setAppointmentStatus}>
                            <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value={st} /><input type="hidden" name="dia" value={day} />
                            <button className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${cls}`}><Icon size={15} aria-hidden />{text}</button>
                          </form>
                        ))}
                        {role === "owner" ? (
                          <form action={setAppointmentStatus}>
                            <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="cancelled" /><input type="hidden" name="dia" value={day} />
                            <button className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-surface-2 hover:text-danger"><X size={15} aria-hidden />Cancelar</button>
                          </form>
                        ) : null}
                      </div>
                    ) : <span className={`text-sm ${text}`}>{label}</span>}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
