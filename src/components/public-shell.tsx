import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

// Faixa de abertura das telas do cliente: placa escura com azulejo e o poste na base.
export function PublicTop({ title, kicker, back, actions, wide = false }: {
  title: string; kicker?: string; back?: { href: string; label: string }; actions?: ReactNode; wide?: boolean;
}) {
  return (
    <div className="hex-dark relative bg-night text-night-ink">
      <span className="pole absolute inset-x-0 bottom-0 h-1.5" aria-hidden />
      <div className={`mx-auto w-full px-5 pb-9 pt-[max(1.25rem,env(safe-area-inset-top))] ${wide ? "max-w-5xl" : "max-w-2xl"}`}>
        <div className="flex items-center justify-between gap-3">
          {back ? (
            <Link href={back.href} className="inline-flex min-h-10 items-center gap-1.5 text-sm text-night-muted hover:text-white"><ArrowLeft size={16} aria-hidden />{back.label}</Link>
          ) : <span className="font-display text-xl">BarberFlow</span>}
          {actions}
        </div>
        {kicker ? <p className="mt-7 text-sm text-night-muted">{kicker}</p> : null}
        <h1 className={`font-display text-5xl leading-[0.95] sm:text-6xl ${kicker ? "mt-1" : "mt-7"}`}>{title}</h1>
      </div>
    </div>
  );
}
