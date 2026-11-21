import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Phone, TriangleAlert, UserX, X } from "lucide-react";
import { setAppointmentStatus } from "@/app/actions/shop";
import { getUser, requireShopAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { brl, canClose, dayMonth, daysAgo, greeting, longDate, nextQuarter, nowISO, relTime, spParts, spStartISO, timeBR } from "@/lib/format";
import { loadFlags, loadStaffPros } from "@/lib/staff-data";
import { RefreshButton } from "@/components/refresh-button";
import { WalkInButton } from "@/components/walkin-form";
import { RescheduleButton } from "@/components/reschedule-form";
import { waLink } from "@/lib/whatsapp";
import { Empty, WhatsAppLink } from "@/components/kit";
import { SubmitBtn } from "@/components/submit-btn";

export const metadata: Metadata = { title: "Hoje" };

type Appt = {
  id: string; starts_at: string; ends_at: string; status: string; price_cents: number; customer_id: string; service_id: string; professional_id: string;
  customers: { full_name: string; phone: string | null } | null;
  services: { name: string } | null;
  professionals: { display_name: string } | null;
};
const SELECT = "id, starts_at, ends_at, status, price_cents, customer_id, service_id, professional_id, customers(full_name, phone), services(name), professionals(display_name)";

function Actions({ slug, id, owner, size, started = true, resched }: { slug: string; id: string; owner: boolean; size: "lg" | "sm"; started?: boolean; resched?: React.ReactNode }) {
  const lg = size === "lg";
  const btn = `inline-flex items-center justify-center gap-2 rounded-xl font-medium ${lg ? "min-h-12 flex-1 px-4 text-base" : "min-h-11 flex-1 px-3 text-sm"}`;
  const items: [string, string, typeof Check, string][] = [
    ["completed", "Concluir", Check, "bg-night text-white hover:bg-night-2"],
    ["no_show", "Faltou", UserX, "border border-line-strong bg-surface hover:bg-surface-2"],
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {resched}
      {started ? items.map(([st, label, Icon, cls]) => (
        <form key={st} action={setAppointmentStatus} className="flex flex-1">
          <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value={st} /><input type="hidden" name="next" value={`/painel/${slug}`} />
          <SubmitBtn className={`${btn} ${cls} w-full`}><Icon size={lg ? 19 : 17} aria-hidden />{label}</SubmitBtn>
        </form>
      )) : items.map(([st, label, Icon]) => (
        <button key={st} type="button" disabled title="Libera perto do horário do atendimento" className={`${btn} flex-1 cursor-not-allowed border border-line bg-surface-2 text-muted opacity-70`}><Icon size={lg ? 19 : 17} aria-hidden />{label}</button>
      ))}
      {owner ? (
        <form action={setAppointmentStatus}>
          <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value="cancelled" /><input type="hidden" name="next" value={`/painel/${slug}`} />
          <SubmitBtn className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line-strong px-3 text-muted hover:border-danger hover:text-danger"><X size={18} aria-label="Cancelar agendamento" /></SubmitBtn>
        </form>
      ) : null}
    </div>
  );
}

function Flag({ f }: { f?: { no_shows: number; blocked: boolean } }) {
  if (!f || (f.no_shows === 0 && !f.blocked)) return null;
  return <p className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-warn/30 bg-warn-bg px-2 py-0.5 text-xs text-warn"><TriangleAlert size={12} aria-hidden />{f.no_shows > 0 ? `${f.no_shows} ${f.no_shows === 1 ? "falta" : "faltas"} em 90 dias` : ""}{f.no_shows > 0 && f.blocked ? " · " : ""}{f.blocked ? "agendamento online bloqueado" : ""}</p>;
}

function Contact({ a, shop }: { a: Appt; shop: string }) {
  const first = (a.customers?.full_name ?? "").trim().split(/\s+/)[0];
  const wa = waLink(a.customers?.phone, `Olá${first ? `, ${first}` : ""}! Aqui é da ${shop}.`);
  const tel = (a.customers?.phone ?? "").replace(/\D/g, "");
  if (!wa && !tel) return null;
  const cls = "inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-sm hover:bg-surface-2";
  return (
    <div className="flex gap-2">
      {wa ? <WhatsAppLink href={wa} /> : null}
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
  const user = await getUser();
  const [pros, flags] = await Promise.all([
    loadStaffPros(supabase, barbershop.id, owner, user?.id ?? ""),
    loadFlags(supabase, barbershop.id, [...overdue, ...open].map((a) => a.customer_id)),
  ]);
  const q = nextQuarter();
  const resched = (a: Appt, cls?: string) => {
    const p = spParts(a.starts_at);
    return <RescheduleButton slug={slug} id={a.id} date={p.ymd} time={timeBR(a.starts_at)} who={a.customers?.full_name ?? "Cliente"} proId={a.professional_id}
      pros={owner ? pros.filter((x) => x.services.some((sv) => sv.id === a.service_id)).map((x) => ({ id: x.id, name: x.name })) : undefined} className={cls} />;
  };

  const card = "rounded-2xl border border-line bg-surface";
  const h2 = "font-display mb-3 text-2xl leading-none";
  const sub = (a: Appt) => `${a.services?.name ?? "Serviço"}${owner ? ` · ${a.professionals?.display_name}` : ""} · ${brl(a.price_cents)}`;

  return (
    <div className="mx-auto max-w-2xl lg:max-w-5xl">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-5xl leading-none">{greeting()}.</h1>
          <p className="mt-2 text-sm text-muted first-letter:uppercase">{longDate(today)}</p>
        </div>
        <RefreshButton />
      </header>
      <div className="mb-4"><WalkInButton slug={slug} pros={pros} date={q.date} time={q.time} className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 text-base font-semibold text-white shadow-[0_6px_16px_rgb(210_55_43/.28)] hover:bg-accent-hover active:translate-y-px sm:w-auto" /></div>
      {sp.erro ? <p role="alert" className="mb-4 rounded-xl border border-danger/30 bg-danger-bg px-4 py-3 text-sm text-danger">Não foi possível atualizar o atendimento. Tente de novo.</p> : null}

      <section aria-label="Resumo do dia" className="hex-dark relative mb-4 overflow-hidden rounded-2xl bg-night p-5 pt-6 text-night-ink">
        <p className="text-sm text-night-muted">{owner ? "Faturado hoje" : "Você faturou hoje"}</p>
        <p className="font-display mt-1 text-5xl leading-none sm:text-7xl">{brl(earned)}</p>
        <div className="mt-5 grid grid-cols-[auto_auto_minmax(0,1fr)] gap-x-5 border-t border-night-line pt-4 sm:gap-x-8">
          <div><p className="font-display whitespace-nowrap text-2xl leading-none sm:text-3xl">{doneToday.length}</p><p className="mt-1 text-sm text-night-muted">atendidos</p></div>
          <div><p className="font-display whitespace-nowrap text-2xl leading-none sm:text-3xl">{open.length + overdue.filter((a) => spParts(a.starts_at).ymd === today).length}</p><p className="mt-1 text-sm text-night-muted">faltam</p></div>
          <div><p className="font-display whitespace-nowrap text-2xl leading-none sm:text-3xl">{brl(expected)}</p><p className="mt-1 text-sm text-night-muted">a receber</p></div>
        </div>
        {!owner && pct > 0 ? <p className="mt-4 rounded-lg bg-night-2 px-3 py-2 text-sm">Sua comissão de hoje: <strong className="font-semibold text-flare">{brl(Math.round((earned * pct) / 100))}</strong> <span className="text-night-muted">({String(pct).replace(".", ",")}%)</span></p> : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          {overdue.length > 0 ? (
            <section aria-label="Atendimentos para fechar" className="rounded-2xl border border-warn/40 bg-warn-bg">
              <div className="flex items-start gap-3 px-5 pt-4">
                <TriangleAlert size={20} className="mt-0.5 shrink-0 text-warn" aria-hidden />
                <div>
                  <h2 className="font-display text-2xl leading-tight">{overdue.length} {overdue.length === 1 ? "atendimento para fechar" : "atendimentos para fechar"}</h2>
                  <p className="text-xs text-muted">O horário passou e ninguém marcou como concluído ou falta. Enquanto isso, o valor não entra no caixa.</p>
                </div>
              </div>
              <ul className="space-y-3 p-4">
                {overdue.map((a) => {
                  const d = spParts(a.starts_at).ymd;
                  return (
                    <li key={a.id} className="rounded-xl border border-line bg-surface p-3.5">
                      <div className="mb-3">
                        <p className="font-medium">{a.customers?.full_name ?? "Cliente"}</p>
                        <p className="text-sm text-muted">{d === today ? "Hoje" : dayMonth(d)} às {timeBR(a.starts_at)} · {sub(a)}</p>
                        <Flag f={flags.get(a.customer_id)} />
                      </div>
                      <Actions slug={slug} id={a.id} owner={owner} size="sm" />
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {next ? (
            <section aria-label="Próximo cliente" className="comanda-wrap">
              <div className="comanda flex">
                <div className="comanda-stub flex shrink-0 flex-col items-center justify-start bg-night px-1 py-5 text-center text-night-ink">
                  <span className="font-display text-3xl leading-none">{timeBR(next.starts_at)}</span>
                  <span className="mt-1.5 text-[11px] leading-tight text-night-muted">{relTime(next.starts_at)}</span>
                </div>
                <div className="min-w-0 flex-1 p-5 pl-6">
                  <p className="text-sm font-medium text-accent">Próximo cliente</p>
                  <p className="font-display mt-1 text-4xl leading-none">{next.customers?.full_name ?? "Cliente"}</p>
                  <p className="mt-2 text-sm text-muted">{sub(next)}</p>
                  <Flag f={flags.get(next.customer_id)} />
                  <div className="mt-4"><Contact a={next} shop={barbershop.name} /></div>
                  <div className="mt-4"><Actions slug={slug} id={next.id} owner={owner} size="lg" started={canClose(next.starts_at)} resched={resched(next, "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line-strong px-4 text-base hover:bg-surface-2")} /></div>
                </div>
              </div>
            </section>
          ) : overdue.length === 0 ? (
            <Empty>{todayAll.length === 0 ? "Nenhum horário hoje. Compartilhe a página pública para receber agendamentos." : "Sem mais clientes por hoje."}</Empty>
          ) : null}

          {later.length > 0 ? (
            <section aria-label="Mais tarde" className={`${card} p-5`}>
              <h2 className={h2}>Mais tarde</h2>
              <ol className="divide-y divide-line">
                {later.map((a) => (
                  <li key={a.id} className="flex items-center gap-4 py-3">
                    <span className="font-display w-14 shrink-0 text-2xl leading-none">{timeBR(a.starts_at)}</span>
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
              <h2 className={h2}>Já passou</h2>
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
            <h2 className="font-display text-2xl leading-none">Amanhã</h2>
            <p className="mt-1 text-sm text-muted">
              {tomorrowList.length === 0 ? "Nenhum horário marcado ainda." : `${tomorrowList.length} ${tomorrowList.length === 1 ? "horário" : "horários"}, começando às ${timeBR(tomorrowList[0].starts_at)}.`}
            </p>
            <Link href={`/painel/${slug}/agenda?dia=${tomorrow}`} className="mt-3 inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-accent hover:underline">Ver agenda de amanhã <ArrowRight size={16} aria-hidden /></Link>
          </section>
        </div>
      </div>
    </div>
  );
}
