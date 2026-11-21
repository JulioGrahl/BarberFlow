"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { getSlots, type Slot } from "@/app/actions/booking";
import { brl, dayMonth, weekdayShort } from "@/lib/format";

type Service = { id: string; name: string; price_cents: number; duration_minutes: number };
type Pro = { id: string; name: string; serviceIds: string[] };

const chip = (on: boolean) =>
  `rounded-lg border px-3.5 py-2.5 text-sm transition ${on ? "border-accent bg-surface-2 text-accent" : "border-line bg-surface hover:bg-surface-2"}`;

function Step({ n, title, done, children }: { n: number; title: string; done?: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-[2rem_1fr] gap-x-4">
      <span className={`font-display flex size-8 items-center justify-center rounded-full border text-sm ${done ? "border-accent bg-accent text-accent-ink" : "border-line text-muted"}`}>{done ? <Check size={16} aria-hidden /> : n}</span>
      <div className="min-w-0 pb-8">
        <h2 className="font-display text-xl leading-8">{title}{done ? <span className="ml-3 font-sans text-sm text-muted">{done}</span> : null}</h2>
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
              <span>{s.name} <span className="text-muted">· {s.duration_minutes} min</span></span>
              <span className="font-display text-lg">{brl(s.price_cents)}</span>
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
              <button key={d} type="button" onClick={() => { setDay(d); load(service, pro, d); }} className={`${chip(day === d)} min-w-14 shrink-0 text-center`}>
                <span className="block text-xs text-muted">{weekdayShort(d)}</span>
                <span className="font-display text-lg">{dayMonth(d).slice(0, 2)}</span>
                <span className="block text-[10px] text-muted">{dayMonth(d).slice(3)}</span>
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
              {slots.map((s) => <button key={s.iso} type="button" onClick={() => setAt(s.iso)} className={`${chip(at === s.iso)} text-center tabular-nums`}>{s.label}</button>)}
            </div>
          )}
        </Step>
      ) : null}

      {href ? (
        <div className="sticky bottom-4 rounded-xl border border-line bg-surface/95 p-3 shadow-xl backdrop-blur">
          <Link href={href} className="block rounded-lg bg-accent px-4 py-3 text-center font-semibold text-accent-ink hover:brightness-110">
            Continuar · {sv?.name}, {picked?.label}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
