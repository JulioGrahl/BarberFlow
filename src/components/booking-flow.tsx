"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { getSlots, type Slot } from "@/app/actions/booking";
import { brl, dayMonth, weekdayShort } from "@/lib/format";

type Service = { id: string; name: string; price_cents: number; duration_minutes: number };
type Pro = { id: string; name: string; serviceIds: string[] };

const chip = (on: boolean) =>
  `rounded-xl border px-4 py-3 text-sm transition active:scale-[.985] ${on ? "border-night bg-night text-night-ink" : "border-line-strong bg-surface hover:border-night"}`;

function Step({ n, title, done, children }: { n: number; title: string; done?: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-[2rem_1fr] gap-x-4">
      <span className={`font-display flex size-9 items-center justify-center rounded-full text-lg ${done ? "bg-accent text-white" : "border-2 border-night text-ink"}`}>{done ? <Check size={17} aria-hidden /> : n}</span>
      <div className="min-w-0 pb-9">
        <h2 className="font-display text-3xl leading-9">{title}{done ? <span className="ml-3 font-sans text-sm font-normal text-muted">{done}</span> : null}</h2>
        <div className="mt-3">{children}</div>
      </div>
    </section>
  );
}

export function BookingFlow({ shop, slug, services, pros, days }: { shop: string; slug: string; services: Service[]; pros: Pro[]; days: string[] }) {
  const [service, setService] = useState<string>();
  const [pro, setPro] = useState<string>();
  const [day, setDay] = useState<string>();
  const [slots, setSlots] = useState<Slot[]>();
  const [at, setAt] = useState<string>();
  const [loading, start] = useTransition();

  const available = pros.filter((p) => service && p.serviceIds.includes(service));
  const sv = services.find((s) => s.id === service);
  const pr = pros.find((p) => p.id === pro);
  const picked = slots?.find((s) => s.iso === at);

  const load = (s?: string, p?: string, d?: string) => {
    setAt(undefined);
    setSlots(undefined);
    if (s && p && d) start(async () => setSlots(await getSlots(shop, p, s, d)));
  };
  const href = service && pro && at ? `/b/${slug}/agendar/confirmar?service=${service}&pro=${pro}&at=${encodeURIComponent(at)}` : null;

  return (
    <div>
      <Step n={1} title="Serviço" done={sv ? `${sv.name} · ${brl(sv.price_cents)}` : undefined}>
        <div className="grid gap-2">
          {services.map((s) => (
            <button key={s.id} type="button" onClick={() => { setService(s.id); setPro(undefined); setDay(undefined); load(); }} className={`flex items-center justify-between text-left ${chip(service === s.id)}`}>
              <span><span className="text-base font-medium">{s.name}</span> <span className={service === s.id ? "text-night-muted" : "text-muted"}>· {s.duration_minutes} min</span></span>
              <span className="font-display text-2xl leading-none">{brl(s.price_cents)}</span>
            </button>
          ))}
        </div>
      </Step>

      {service ? (
        <Step n={2} title="Profissional" done={pr?.name}>
          {available.length === 0 ? <p className="text-sm text-muted">Nenhum profissional disponível para este serviço.</p> : (
            <div className="flex flex-wrap gap-2">
              {available.map((p) => <button key={p.id} type="button" onClick={() => { setPro(p.id); load(service, p.id, day); }} className={chip(pro === p.id)}>{p.name}</button>)}
            </div>
          )}
        </Step>
      ) : null}

      {pro ? (
        <Step n={3} title="Dia" done={day ? `${weekdayShort(day)} ${dayMonth(day)}` : undefined}>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {days.map((d) => (
              <button key={d} type="button" onClick={() => { setDay(d); load(service, pro, d); }} className={`${chip(day === d)} min-w-16 shrink-0 px-2 text-center`}>
                <span className={`block text-xs ${day === d ? "text-night-muted" : "text-muted"}`}>{weekdayShort(d)}</span>
                <span className="font-display text-3xl leading-tight">{dayMonth(d).slice(0, 2)}</span>
                <span className={`block text-[10px] ${day === d ? "text-night-muted" : "text-muted"}`}>{dayMonth(d).slice(3)}</span>
              </button>
            ))}
          </div>
        </Step>
      ) : null}

      {pro && day ? (
        <Step n={4} title="Horário" done={picked?.label}>
          {loading || !slots ? <p className="text-sm text-muted">Buscando horários…</p> : slots.length === 0 ? (
            <p className="text-sm text-muted">Sem horários livres neste dia. Escolha outro dia acima.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {slots.map((s) => <button key={s.iso} type="button" onClick={() => setAt(s.iso)} className={`${chip(at === s.iso)} font-display px-0 text-center text-xl`}>{s.label}</button>)}
            </div>
          )}
        </Step>
      ) : null}

      {href ? (
        <div className="sticky bottom-[max(1rem,env(safe-area-inset-bottom))] rounded-2xl bg-night p-2.5 shadow-[0_12px_32px_rgb(14_27_37/.35)]">
          <Link href={href} className="block min-h-12 rounded-xl bg-accent px-4 py-3 text-center font-semibold text-white hover:bg-accent-hover">
            Continuar · {sv?.name}, {picked?.label}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
