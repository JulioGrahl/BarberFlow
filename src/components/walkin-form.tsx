"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { createWalkIn } from "@/app/actions/shop";
import { Drawer } from "@/components/drawer";
import { ActionForm, inputCls, L } from "@/components/master-forms";
import type { StaffPro } from "@/lib/staff-data";

// "Novo atendimento": a equipe agenda para quem chegou ou pediu pelo WhatsApp, sem exigir conta do cliente.
export function WalkInButton({ slug, pros, date, time, className }: { slug: string; pros: StaffPro[]; date: string; time: string; className?: string }) {
  const [proId, setProId] = useState(pros[0]?.id ?? "");
  const services = pros.find((p) => p.id === proId)?.services ?? [];
  if (pros.length === 0) return null;
  return (
    <Drawer title="Novo atendimento" triggerClassName={className ?? "inline-flex min-h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink hover:brightness-110"}
      trigger={<><Plus size={17} aria-hidden /> Novo atendimento</>}>
      <p className="mb-4 text-sm text-muted">Para cliente que chegou na hora ou pediu por WhatsApp. Não precisa de conta. Se o WhatsApp já estiver cadastrado, o atendimento entra no mesmo cliente.</p>
      <ActionForm action={createWalkIn} submit="Agendar" pending="Agendando…">
        <input type="hidden" name="slug" value={slug} />
        <L label="Nome do cliente"><input name="name" required minLength={2} maxLength={120} autoComplete="off" className={inputCls} /></L>
        <L label="WhatsApp (com DDD, opcional)"><input name="phone" type="tel" inputMode="tel" autoComplete="off" placeholder="(47) 99999-9999" className={inputCls} /></L>
        {pros.length > 1 ? (
          <L label="Profissional">
            <select name="pro" value={proId} onChange={(e) => setProId(e.target.value)} className={inputCls}>{pros.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </L>
        ) : <input type="hidden" name="pro" value={proId} />}
        <L label="Serviço">
          <select name="service" key={proId} required className={inputCls}>{services.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        </L>
        <div className="grid grid-cols-2 gap-3">
          <L label="Dia"><input name="date" type="date" required defaultValue={date} className={inputCls} /></L>
          <L label="Horário"><input name="time" type="time" required defaultValue={time} step={300} className={inputCls} /></L>
        </div>
      </ActionForm>
    </Drawer>
  );
}
