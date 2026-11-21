import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">{title}</h1>
        {sub ? <p className="mt-1 text-sm text-muted">{sub}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Panel({ title, sub, aside, children, className = "" }: { title?: string; sub?: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-line bg-surface ${className}`}>
      {title ? (
        <div className="flex items-start justify-between gap-3 px-5 pt-4">
          <div>
            <h2 className="font-display text-lg">{title}</h2>
            {sub ? <p className="text-xs text-muted">{sub}</p> : null}
          </div>
          {aside}
        </div>
      ) : null}
      <div className="p-5 pt-4">{children}</div>
    </section>
  );
}

// Variação percentual contra o período anterior (null = sem base de comparação)
export function Delta({ pct, inverse = false }: { pct: number | null; inverse?: boolean }) {
  if (pct === null) return <span className="text-xs text-muted">sem comparação</span>;
  const up = pct >= 0;
  const good = inverse ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs ${good ? "text-success" : "text-danger"}`}>
      <Icon size={14} aria-hidden />{Math.abs(pct).toFixed(0)}% <span className="text-muted">vs. período anterior</span>
    </span>
  );
}

export function Stat({ label, value, children, hero = false }: { label: string; value: string; children?: ReactNode; hero?: boolean }) {
  return (
    <div className={`rounded-xl border border-line bg-surface p-4 ${hero ? "sm:col-span-2" : ""}`}>
      <p className="text-sm text-muted">{label}</p>
      <p className={`font-display mt-1 leading-none ${hero ? "text-5xl" : "text-3xl"}`}>{value}</p>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{children}</p>;
}

export const pctChange = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);
