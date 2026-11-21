"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

type Initial = { on: boolean; start: string; end: string; bs: string; be: string };

const time = "min-h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-base tabular-nums";

// Uma linha por dia: interruptor + nome + resumo. Os horários só aparecem quando o dia está aberto,
// e o intervalo é opcional (botão "Adicionar intervalo"), em vez de campos vazios em todo dia.
export function DayHours({ day, name, initial }: { day: number; name: string; initial: Initial }) {
  const [on, setOn] = useState(initial.on);
  const [brk, setBrk] = useState(Boolean(initial.bs && initial.be));
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [bs, setBs] = useState(initial.bs || "12:00");
  const [be, setBe] = useState(initial.be || "13:00");

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center gap-3">
        <label className="flex min-h-10 flex-1 cursor-pointer items-center gap-3">
          <span className="relative inline-flex h-6 w-11 shrink-0">
            <input type="checkbox" name={`on_${day}`} checked={on} onChange={(e) => setOn(e.target.checked)} className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer opacity-0" />
            <span className="absolute inset-0 rounded-full bg-line-strong transition peer-checked:bg-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue" aria-hidden />
            <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" aria-hidden />
          </span>
          <span className={`font-semibold ${on ? "" : "text-muted"}`}>{name}</span>
        </label>
        <span className="text-sm tabular-nums text-muted">
          {on ? `${start} – ${end}${brk ? ` · pausa ${bs}–${be}` : ""}` : "Fechado"}
        </span>
      </div>

      {/* campos sempre enviados; só ficam visíveis quando o dia está aberto */}
      <div className={on ? "mt-3 space-y-3 pl-14" : "hidden"}>
        <div className="grid max-w-md grid-cols-2 gap-3">
          <label className="block text-sm"><span className="mb-1 block text-muted">Abre</span>
            <input type="time" name={`start_${day}`} value={start} onChange={(e) => setStart(e.target.value)} className={time} aria-label={`${name}: abertura`} /></label>
          <label className="block text-sm"><span className="mb-1 block text-muted">Fecha</span>
            <input type="time" name={`end_${day}`} value={end} onChange={(e) => setEnd(e.target.value)} className={time} aria-label={`${name}: fechamento`} /></label>
        </div>
        {brk ? (
          <div className="max-w-md">
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm"><span className="mb-1 block text-muted">Pausa começa</span>
                <input type="time" name={`bs_${day}`} value={bs} onChange={(e) => setBs(e.target.value)} className={time} aria-label={`${name}: início do intervalo`} /></label>
              <label className="block text-sm"><span className="mb-1 block text-muted">Pausa termina</span>
                <input type="time" name={`be_${day}`} value={be} onChange={(e) => setBe(e.target.value)} className={time} aria-label={`${name}: fim do intervalo`} /></label>
            </div>
            <button type="button" onClick={() => setBrk(false)} className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-danger hover:bg-danger-bg"><X size={15} aria-hidden />Remover pausa</button>
          </div>
        ) : (
          <>
            <input type="hidden" name={`bs_${day}`} value="" /><input type="hidden" name={`be_${day}`} value="" />
            <button type="button" onClick={() => setBrk(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-sm font-medium hover:bg-surface-2"><Plus size={15} aria-hidden />Adicionar pausa (almoço)</button>
          </>
        )}
      </div>
      {!on ? (<><input type="hidden" name={`start_${day}`} value={start} /><input type="hidden" name={`end_${day}`} value={end} /><input type="hidden" name={`bs_${day}`} value="" /><input type="hidden" name={`be_${day}`} value="" /></>) : null}
    </div>
  );
}
