import type { Metadata } from "next";
import Link from "next/link";
import { setAppointmentStatus } from "@/app/actions/shop";
import { requireShopAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { brl, dayMonth, nextDays, timeBR, weekdayShort } from "@/lib/format";

export const metadata: Metadata = { title: "Agenda" };

type Row = {
  id: string; starts_at: string; ends_at: string; status: string; price_cents: number;
  customers: { full_name: string; phone: string | null } | null;
  services: { name: string } | null;
  professionals: { display_name: string } | null;
};
const STATUS: Record<string, [string, string]> = {
  scheduled: ["Agendado", "border-accent/40 text-accent"],
  completed: ["Concluído", "border-success/40 text-success"],
  no_show: ["Não compareceu", "border-warn/40 text-warn"],
  cancelled: ["Cancelado", "border-line text-muted"],
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

  const supabase = await createClient();
  let q = supabase
    .from("appointments")
    .select("id, starts_at, ends_at, status, price_cents, customers(full_name, phone), services(name), professionals(display_name)")
    .eq("barbershop_id", barbershop.id).gte("starts_at", from).lt("starts_at", to).order("starts_at");
  if (role === "owner" && sp.pro) q = q.eq("professional_id", sp.pro);
  const [{ data }, pros] = await Promise.all([
    q,
    role === "owner" ? supabase.from("professionals").select("id, display_name").eq("barbershop_id", barbershop.id).eq("active", true).order("display_name") : Promise.resolve({ data: [] }),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const total = rows.filter((r) => r.status === "completed").reduce((a, r) => a + r.price_cents, 0);
  const base = `/painel/${slug}/agenda`;
  const qs = (d: string) => `${base}?dia=${d}${sp.pro ? `&pro=${sp.pro}` : ""}`;
  const pill = "rounded-xl border border-line px-3.5 py-2 text-sm hover:bg-surface";

  return (
    <>
      <h1 className="text-2xl font-semibold">Agenda</h1>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link href={qs(addDays(day, -1))} className={pill}>←</Link>
        <span className="px-2 text-sm font-medium">{weekdayShort(day)} {dayMonth(day)}{day === today ? " (hoje)" : ""}</span>
        <Link href={qs(addDays(day, 1))} className={pill}>→</Link>
        {day !== today ? <Link href={qs(today)} className={pill}>Hoje</Link> : null}
      </div>
      {role === "owner" && (pros.data ?? []).length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`${base}?dia=${day}`} className={`${pill} ${!sp.pro ? "border-accent text-accent" : ""}`}>Todos</Link>
          {(pros.data ?? []).map((p) => <Link key={p.id} href={`${base}?dia=${day}&pro=${p.id}`} className={`${pill} ${sp.pro === p.id ? "border-accent text-accent" : ""}`}>{p.display_name}</Link>)}
        </div>
      ) : null}
      {sp.erro ? <p role="alert" className="mt-4 rounded-xl border border-danger/40 px-3.5 py-2.5 text-sm text-danger">Não foi possível atualizar o atendimento.</p> : null}
      <p className="mt-4 text-sm text-muted">{rows.length} atendimento(s){role === "owner" ? ` · concluídos: ${brl(total)}` : ""}</p>
      <ul className="mt-3 space-y-3">
        {rows.length === 0 ? <li className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">Nenhum atendimento neste dia.</li> : rows.map((r) => {
          const [label, tone] = STATUS[r.status] ?? [r.status, "border-line"];
          return (
            <li key={r.id} className="rounded-2xl border border-line bg-surface p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-medium">{timeBR(r.starts_at)} – {timeBR(r.ends_at)} · {r.customers?.full_name ?? "Cliente"}</p>
                  <p className="text-muted">{r.services?.name} · {r.professionals?.display_name} · {brl(r.price_cents)}</p>
                  {r.customers?.phone ? <p className="text-muted">{r.customers.phone}</p> : null}
                </div>
                <span className={`rounded-full border px-2.5 py-0.5 text-xs ${tone}`}>{label}</span>
              </div>
              {r.status === "scheduled" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {([["completed", "Concluir"], ["no_show", "Não compareceu"], ...(role === "owner" ? [["cancelled", "Cancelar"]] : [])] as [string, string][]).map(([st, text]) => (
                    <form key={st} action={setAppointmentStatus}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="status" value={st} />
                      <input type="hidden" name="dia" value={day} />
                      <button className="rounded-lg border border-line px-3 py-1.5 hover:bg-surface-2">{text}</button>
                    </form>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}
