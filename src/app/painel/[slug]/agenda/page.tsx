import type { Metadata } from "next";
import Link from "next/link";
import { setAppointmentStatus } from "@/app/actions/shop";
import { requireShopAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { brl, longDate, nextDays, spParts, timeBR, weekdayShort } from "@/lib/format";
import { Empty, PageHead } from "@/components/kit";
import { Check, ChevronLeft, ChevronRight, UserX, X } from "lucide-react";

export const metadata: Metadata = { title: "Agenda" };

type Row = {
  id: string; starts_at: string; ends_at: string; status: string; price_cents: number;
  customers: { full_name: string; phone: string | null } | null;
  services: { name: string } | null;
  professionals: { display_name: string } | null;
};
const STATUS: Record<string, [string, string, string]> = {
  scheduled: ["Agendado", "bg-accent", "text-accent"],
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
    .select("id, starts_at, ends_at, status, price_cents, customers(full_name, phone), services(name), professionals(display_name)")
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
        </>
      } />

      <nav aria-label="Semana" className="mb-5 grid grid-cols-7 gap-1.5">
        {week.map((d) => {
          const on = d === day, n = counts.get(d) ?? 0;
          return (
            <Link key={d} href={qs(d)} aria-current={on ? "date" : undefined}
              className={`rounded-lg border px-1 py-2.5 text-center transition ${on ? "border-accent bg-surface-2" : "border-line hover:bg-surface"}`}>
              <span className="block text-xs text-muted">{weekdayShort(d)}</span>
              <span className={`font-display block text-xl leading-tight ${d === today ? "text-accent" : ""}`}>{d.slice(8)}</span>
              <span className="mt-1 flex h-1.5 justify-center gap-0.5">{Array.from({ length: Math.min(n, 5) }, (_, i) => <i key={i} className="size-1.5 rounded-full bg-accent/70" />)}</span>
            </Link>
          );
        })}
      </nav>

      {role === "owner" && (pros.data ?? []).length > 0 ? (
        <div className="mb-5 inline-flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1">
          {[{ id: "", display_name: "Todos" }, ...(pros.data ?? [])].map((p) => (
            <Link key={p.id} href={p.id ? `${base}?dia=${day}&pro=${p.id}` : `${base}?dia=${day}`}
              className={`rounded-md px-3 py-1.5 text-sm ${(sp.pro ?? "") === p.id ? "bg-surface-2 text-accent" : "text-muted hover:text-ink"}`}>{p.display_name}</Link>
          ))}
        </div>
      ) : null}

      {sp.erro ? <p role="alert" className="mb-4 rounded-lg border border-danger/40 px-3.5 py-2.5 text-sm text-danger">Não foi possível atualizar o atendimento.</p> : null}
      <p className="mb-4 text-sm text-muted">{rows.length === 0 ? "Sem atendimentos" : `${open} por atender · ${rows.length - open} encerrados`}{role === "owner" && total > 0 ? ` · ${brl(total)} concluídos` : ""}</p>

      {rows.length === 0 ? <Empty>Nenhum atendimento neste dia. Escolha outro dia na faixa acima.</Empty> : (
        <ol className="space-y-2">
          {rows.map((r) => {
            const [label, bar, text] = STATUS[r.status] ?? [r.status, "bg-line", "text-muted"];
            return (
              <li key={r.id} className="flex gap-3">
                <div className="w-14 shrink-0 pt-4 text-right"><p className="text-sm font-medium tabular-nums">{timeBR(r.starts_at)}</p><p className="text-xs tabular-nums text-muted">{timeBR(r.ends_at)}</p></div>
                <div className="relative min-w-0 flex-1 overflow-hidden rounded-xl border border-line bg-surface py-3 pl-5 pr-4">
                  <span className={`absolute inset-y-0 left-0 w-1 ${bar}`} aria-hidden />
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.customers?.full_name ?? "Cliente"}</p>
                      <p className="truncate text-sm text-muted">{r.services?.name}{role === "owner" ? ` · ${r.professionals?.display_name}` : ""} · {brl(r.price_cents)}</p>
                      {r.customers?.phone ? <p className="text-xs text-muted">{r.customers.phone}</p> : null}
                    </div>
                    {r.status === "scheduled" ? (
                      <div className="flex gap-1.5">
                        {([["completed", "Concluir", Check, "bg-accent text-accent-ink hover:brightness-110"], ["no_show", "Faltou", UserX, "border border-line hover:bg-surface-2"], ...(role === "owner" ? [["cancelled", "Cancelar", X, "border border-line hover:bg-surface-2 hover:text-danger"]] : [])] as [string, string, typeof Check, string][]).map(([st, text, Icon, cls]) => (
                          <form key={st} action={setAppointmentStatus}>
                            <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value={st} /><input type="hidden" name="dia" value={day} />
                            <button className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${cls}`}><Icon size={15} aria-hidden />{text}</button>
                          </form>
                        ))}
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
