"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { getSlots, type Slot } from "@/app/actions/booking";
import { brl, dayMonth, weekdayShort } from "@/lib/format";

type Service = { id: string; name: string; price_cents: number; duration_minutes: number };
type Pro = { id: string; name: string; serviceIds: string[] };

const chip = (on: boolean) =>
  `rounded-xl border px-3.5 py-2 text-sm transition ${on ? "border-accent bg-accent/10 text-accent" : "border-line bg-surface hover:bg-surface-2"}`;

export function BookingFlow({ shop, slug, services, pros, days }: { shop: string; slug: string; services: Service[]; pros: Pro[]; days: string[] }) {
  const [service, setService] = useState<string>();
  const [pro, setPro] = useState<string>();
  const [day, setDay] = useState<string>();
  const [slots, setSlots] = useState<Slot[]>();
  const [at, setAt] = useState<string>();
  const [loading, start] = useTransition();

  const available = pros.filter((p) => service && p.serviceIds.includes(service));

  const load = (s?: string, p?: string, d?: string) => {
    setAt(undefined);
    setSlots(undefined);
    if (s && p && d) start(async () => setSlots(await getSlots(shop, p, s, d)));
  };

  const href = service && pro && at ? `/b/${slug}/agendar/confirmar?service=${service}&pro=${pro}&at=${encodeURIComponent(at)}` : null;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-medium">1. Serviço</h2>
        <div className="grid gap-2">
          {services.map((s) => (
            <button key={s.id} type="button" onClick={() => { setService(s.id); setPro(undefined); load(); }} className={`flex items-center justify-between text-left ${chip(service === s.id)}`}>
              <span>{s.name} <span className="text-muted">· {s.duration_minutes} min</span></span>
              <span className="font-semibold">{brl(s.price_cents)}</span>
            </button>
          ))}
        </div>
      </section>

      {service ? (
        <section>
          <h2 className="mb-3 text-lg font-medium">2. Profissional</h2>
          {available.length === 0 ? <p className="text-sm text-muted">Nenhum profissional disponível para este serviço.</p> : (
            <div className="flex flex-wrap gap-2">
              {available.map((p) => <button key={p.id} type="button" onClick={() => { setPro(p.id); load(service, p.id, day); }} className={chip(pro === p.id)}>{p.name}</button>)}
            </div>
          )}
        </section>
      ) : null}

      {pro ? (
        <section>
          <h2 className="mb-3 text-lg font-medium">3. Data</h2>
          <div className="flex flex-wrap gap-2">
            {days.map((d) => (
              <button key={d} type="button" onClick={() => { setDay(d); load(service, pro, d); }} className={`${chip(day === d)} text-center`}>
                <span className="block text-xs uppercase text-muted">{weekdayShort(d)}</span>{dayMonth(d)}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {pro && day ? (
        <section>
          <h2 className="mb-3 text-lg font-medium">4. Horário</h2>
          {loading || !slots ? <p className="text-sm text-muted">Buscando horários...</p> : slots.length === 0 ? (
            <p className="text-sm text-muted">Sem horários livres neste dia. Tente outra data.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {slots.map((s) => <button key={s.iso} type="button" onClick={() => setAt(s.iso)} className={`${chip(at === s.iso)} text-center`}>{s.label}</button>)}
            </div>
          )}
        </section>
      ) : null}

      {href ? (
        <Link href={href} className="block rounded-xl bg-accent px-4 py-3 text-center font-semibold text-accent-ink hover:brightness-110">
          Continuar
        </Link>
      ) : null}
    </div>
  );
}
