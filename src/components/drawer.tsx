"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

const Ctx = createContext<{ close: () => void } | null>(null);
export const useDrawer = () => useContext(Ctx);

// Painel lateral nativo (<dialog>): foco preso, Esc fecha, clique fora fecha.
export function Drawer({ trigger, title, children, triggerClassName }: { trigger: ReactNode; title: string; children: ReactNode; triggerClassName?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => ref.current?.close();
  return (
    <Ctx.Provider value={{ close }}>
      <button type="button" onClick={() => ref.current?.showModal()}
        className={triggerClassName ?? "inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover"}>
        {trigger}
      </button>
      <dialog ref={ref} className="drawer" onClick={(e) => { if (e.target === ref.current) close(); }} aria-label={title}>
        <div className="flex h-full flex-col">
          <div className="relative flex items-center justify-between bg-night px-5 py-4 text-night-ink">
            <span className="pole absolute inset-x-0 bottom-0 h-1" aria-hidden />
            <h2 className="font-display text-2xl">{title}</h2>
            <button type="button" onClick={close} aria-label="Fechar" className="rounded-lg p-1.5 text-night-muted hover:bg-night-2 hover:text-night-ink"><X size={18} /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        </div>
      </dialog>
    </Ctx.Provider>
  );
}
