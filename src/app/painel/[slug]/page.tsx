import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, MessageCircle, Phone, TriangleAlert, UserX, X } from "lucide-react";
import { setAppointmentStatus } from "@/app/actions/shop";
import { requireShopAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { brl, dayMonth, daysAgo, greeting, longDate, nowISO, relTime, spParts, spStartISO, timeBR } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { Empty } from "@/components/kit";
import { SubmitBtn } from "@/components/submit-btn";

export const metadata: Metadata = { title: "Hoje" };

type Appt = {
  id: string; starts_at: string; ends_at: string; status: string; price_cents: number;
  customers: { full_name: string; phone: string | null } | null;
  services: { name: string } | null;
  professionals: { display_name: string } | null;
};
const SELECT = "id, starts_at, ends_at, status, price_cents, customers(full_name, phone), services(name), professionals(display_name)";

function Actions({ slug, id, owner, size }: { slug: string; id: string; owner: boolean; size: "lg" | "sm" }) {
  const lg = size === "lg";
  const btn = `inline-flex items-center justify-center gap-2 rounded-xl font-medium ${lg ? "min-h-12 flex-1 px-4 text-base" : "min-h-11 flex-1 px-3 text-sm"}`;
  const items: [string, string, typeof Check, string][] = [
    ["completed", "Concluir", Check, "bg-accent text-accent-ink"],
    ["no_show", "Faltou", UserX, "border border-line bg-surface-2"],
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(([st, label, Icon, cls]) => (
        <form key={st} action={setAppointmentStatus} className="flex flex-1">
          <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value={st} /><input type="hidden" name="next" value={`/painel/${slug}`} />
          <SubmitBtn className={`${btn} ${cls} w-full`}><Icon size={lg ? 19 : 17} aria-hidden />{label}</SubmitBtn>
        </form>
      ))}
      {owner ? (
        <form action={setAppointmentStatus}>
          <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value="cancelled" /><input type="hidden" name="next" value={`/painel/${slug}`} />
          <SubmitBtn className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-3 text-muted hover:text-danger"><X size={18} aria-label="Cancelar agendamento" /></SubmitBtn>
        </form>
      ) : null}
    </div>
  );
}

function Contact({ a, shop }: { a: Appt; shop: string }) {
  const first = (a.customers?.full_name ?? "").trim().split(/\s+/)[0];
  const wa = waLink(a.customers?.phone, `Olá${first ? `, ${first}` : ""}! Aqui é da ${shop}.`);
  const tel = (a.customers?.phone ?? "").replace(/\D/g, "");
  if (!wa && !tel) return null;
  const cls = "inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line px-3 text-sm text-muted hover:text-ink";
  return (
    <div className="flex gap-2">
      {wa ? <a href={wa} target="_blank" rel="noopener noreferrer" className={cls}><MessageCircle size={16} aria-hidden />WhatsApp</a> : null}
      {tel ? <a href={`tel:${tel}`} className={cls}><Phone size={16} aria-hidden />Ligar</a> : null}
    </div>
  );
}

export default async function TodayPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ erro?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { barbershop, role } = await requireShopAccess(slug);
  const owner = role === "owner";
  const supabase = await createClient();
  const today = daysAgo(0), tomorrow = daysAgo(-1);
  const now = nowISO();

  const [t, o, tm, comm] = await Promise.all([
    supabase.from("appointments").select(SELECT).eq("barbershop_id", barbershop.id)
      .gte("starts_at", spStartISO(today)).lt("starts_at", spStartISO(tomorrow)).order("starts_at"),
    supabase.from("appointments").select(SELECT).eq("barbershop_id", barbershop.id).eq("status", "scheduled")
      .lt("ends_at", now).gte("starts_at", spStartISO(daysAgo(30))).order("starts_at").limit(50),
    supabase.from("appointments").select("starts_at").eq("barbershop_id", barbershop.id).neq("status", "cancelled")
      .gte("starts_at", spStartISO(tomorrow)).lt("starts_at", spStartISO(daysAgo(-2))).order("starts_at").limit(100),
    owner ? Promise.resolve({ data: null }) : supabase.from("professional_commissions").select("percent").eq("barbershop_id", barbershop.id).maybeSingle(),
  ]);
  const todayAll = ((t.data ?? []) as unknown as Appt[]);
  const overdue = ((o.data ?? []) as unknown as Appt[]);
  const overdueIds = new Set(overdue.map((a) => a.id));
  const open = todayAll.filter((a) => a.status === "scheduled" && !overdueIds.has(a.id));
  const next = open[0];
  const later = open.slice(1);
  const finished = todayAll.filter((a) => a.status === "completed" || a.status === "no_show");
  const doneToday = todayAll.filter((a) => a.status === "completed");
  const earned = doneToday.reduce((s, a) => s + a.price_cents, 0);
  const expected = todayAll.filter((a) => a.status === "scheduled").reduce((s, a) => s + a.price_cents, 0);
  const pct = Number((comm.data as { percent: number } | null)?.percent ?? 0);
  const tomorrowList = (tm.data ?? []) as { starts_at: string }[];

  const card = "rounded-2xl border border-line bg-surface";
  const sub = (a: Appt) => `${a.services?.name ?? "Serviço"}${owner ? ` · ${a.professionals?.display_name}` : ""} · ${brl(a.price_cents)}`;

  return (
    <div className="mx-auto max-w-2xl lg:max-w-5xl">
      <header className="mb-5">
        <h1 className="font-display text-3xl leading-tight">{greeting()}.</h1>
        <p className="text-sm text-muted first-letter:uppercase">{longDate(today)}</p>
      </header>
      {sp.erro ? <p role="alert" className="mb-4 rounded-xl border border-danger/40 px-4 py-3 text-sm text-danger">Não foi possível atualizar o atendimento. Tente de novo.</p> : null}

      <section aria-label="Resumo do dia" className={`${card} mb-4 p-5`}>
        <p className="text-sm text-muted">{owner ? "Faturado hoje" : "Você faturou hoje"}</p>
        <p className="font-display mt-1 text-5xl leading-none">{brl(earned)}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
          <div><p className="font-display text-2xl leading-none">{doneToday.length}</p><p className="mt-1 text-xs text-muted">atendidos</p></div>
          <div><p className="font-display text-2xl leading-none">{open.length + overdue.filter((a) => spParts(a.starts_at).ymd === today).length}</p><p className="mt-1 text-xs text-muted">faltam</p></div>
          <div><p className="font-display text-2xl leading-none">{brl(expected)}</p><p className="mt-1 text-xs text-muted">a receber</p></div>
        </div>
        {!owner && pct > 0 ? <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-sm">Sua comissão de hoje: <strong className="font-semibold text-accent">{brl(Math.round((earned * pct) / 100))}</strong> <span className="text-muted">({String(pct).replace(".", ",")}%)</span></p> : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          {overdue.length > 0 ? (
            <section aria-label="Atendimentos para fechar" className="rounded-2xl border border-warn/50 bg-surface">
              <div className="flex items-start gap-3 px-5 pt-4">
                <TriangleAlert size={20} className="mt-0.5 shrink-0 text-warn" aria-hidden />
                <div>
                  <h2 className="font-display text-lg leading-tight">{overdue.length} {overdue.length === 1 ? "atendimento para fechar" : "atendimentos para fechar"}</h2>
                  <p className="text-xs text-muted">O horário passou e ninguém marcou como concluído ou falta. Enquanto isso, o valor não entra no caixa.</p>
                </div>
              </div>
              <ul className="space-y-3 p-4">
                {overdue.map((a) => {
                  const d = spParts(a.starts_at).ymd;
                  return (
                    <li key={a.id} className="rounded-xl border border-line bg-surface-2 p-3.5">
                      <div className="mb-3">
                        <p className="font-medium">{a.customers?.full_name ?? "Cliente"}</p>
                        <p className="text-sm text-muted">{d === today ? "Hoje" : dayMonth(d)} às {timeBR(a.starts_at)} · {sub(a)}</p>
                      </div>
                      <Actions slug={slug} id={a.id} owner={owner} size="sm" />
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {next ? (
            <section aria-label="Próximo cliente" className="relative overflow-hidden rounded-2xl border border-accent/60 bg-surface p-5">
              <span className="pole absolute inset-y-0 left-0 w-1.5" aria-hidden />
              <p className="text-sm text-accent">Próximo cliente · {relTime(next.starts_at)}</p>
              <p className="font-display mt-1 text-3xl leading-tight">{next.customers?.full_name ?? "Cliente"}</p>
              <p className="mt-1 text-sm text-muted"><span className="tabular-nums text-ink">{timeBR(next.starts_at)}</span> · {sub(next)}</p>
              <div className="mt-4"><Contact a={next} shop={barbershop.name} /></div>
              <div className="mt-4"><Actions slug={slug} id={next.id} owner={owner} size="lg" /></div>
            </section>
          ) : overdue.length === 0 ? (
            <Empty>{todayAll.length === 0 ? "Nenhum horário hoje. Compartilhe a página pública para receber agendamentos." : "Sem mais clientes por hoje."}</Empty>
          ) : null}

          {later.length > 0 ? (
            <section aria-label="Mais tarde" className={`${card} p-5`}>
              <h2 className="font-display mb-3 text-lg">Mais tarde</h2>
              <ol className="divide-y divide-line">
                {later.map((a) => (
                  <li key={a.id} className="flex items-center gap-4 py-3">
                    <span className="w-12 shrink-0 text-lg tabular-nums">{timeBR(a.starts_at)}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{a.customers?.full_name ?? "Cliente"}</span><span className="block truncate text-sm text-muted">{sub(a)}</span></span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>

        <div className="space-y-4 lg:col-span-2">
          {finished.length > 0 ? (
            <section aria-label="Já atendidos" className={`${card} p-5`}>
              <h2 className="font-display mb-3 text-lg">Já passou</h2>
              <ul className="divide-y divide-line">
                {finished.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="w-11 shrink-0 tabular-nums text-muted">{timeBR(a.starts_at)}</span>
                    <span className="min-w-0 flex-1 truncate">{a.customers?.full_name ?? "Cliente"}</span>
                    <span className={a.status === "completed" ? "text-success" : "text-warn"}>{a.status === "completed" ? brl(a.price_cents) : "faltou"}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-label="Amanhã" className={`${card} p-5`}>
            <h2 className="font-display text-lg">Amanhã</h2>
            <p className="mt-1 text-sm text-muted">
              {tomorrowList.length === 0 ? "Nenhum horário marcado ainda." : `${tomorrowList.length} ${tomorrowList.length === 1 ? "horário" : "horários"}, começando às ${timeBR(tomorrowList[0].starts_at)}.`}
            </p>
            <Link href={`/painel/${slug}/agenda?dia=${tomorrow}`} className="mt-3 inline-flex min-h-10 items-center gap-1.5 text-sm text-accent">Ver agenda de amanhã <ArrowRight size={16} aria-hidden /></Link>
          </section>
        </div>
      </div>
    </div>
  );
}
