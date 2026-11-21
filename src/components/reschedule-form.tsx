"use client";

import { CalendarClock } from "lucide-react";
import { staffReschedule } from "@/app/actions/shop";
import { Drawer } from "@/components/drawer";
import { ActionForm, inputCls, L } from "@/components/master-forms";

// Remarcar (equipe): qualquer horário livre; só o dono pode trocar o profissional.
export function RescheduleButton({ slug, id, date, time, who, proId, pros, className }: {
  slug: string; id: string; date: string; time: string; who: string; proId: string; pros?: { id: string; name: string }[]; className?: string;
}) {
  return (
    <Drawer title="Remarcar" triggerClassName={className ?? "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line px-3 text-sm hover:bg-surface-2"}
      trigger={<><CalendarClock size={16} aria-hidden /> Remarcar</>}>
      <p className="mb-4 text-sm text-muted">Mover o horário de <strong className="text-ink">{who}</strong>. O horário antigo fica livre.</p>
      <ActionForm action={staffReschedule} submit="Salvar novo horário" pending="Salvando…">
        <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={id} />
        <div className="grid grid-cols-2 gap-3">
          <L label="Novo dia"><input name="date" type="date" required defaultValue={date} className={inputCls} /></L>
          <L label="Novo horário"><input name="time" type="time" required defaultValue={time} step={300} className={inputCls} /></L>
        </div>
        {pros && pros.length > 1 ? (
          <L label="Profissional"><select name="pro" defaultValue={proId} className={inputCls}>{pros.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></L>
        ) : null}
      </ActionForm>
    </Drawer>
  );
}
