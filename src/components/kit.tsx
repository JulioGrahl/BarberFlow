import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-stretch gap-3.5">
        <span className="pole w-1.5 shrink-0 rounded-full" aria-hidden />
        <div>
          <h1 className="font-display text-4xl leading-none sm:text-5xl">{title}</h1>
          {sub ? <p className="mt-2 text-sm text-muted">{sub}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Panel({ title, sub, aside, children, className = "" }: { title?: string; sub?: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-surface ${className}`}>
      {title ? (
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3.5">
          <div>
            <h2 className="font-display text-xl leading-tight">{title}</h2>
            {sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}
          </div>
          {aside}
        </div>
      ) : null}
      <div className="p-5">{children}</div>
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
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${good ? "bg-success-bg text-success" : "bg-danger-bg text-danger"}`}>
      <Icon size={13} aria-hidden />{Math.abs(pct).toFixed(0)}% <span className="font-normal opacity-80">vs. anterior</span>
    </span>
  );
}

// O destaque (hero) vira placa escura; os demais são ladrilhos claros.
export function Stat({ label, value, children, hero = false }: { label: string; value: string; children?: ReactNode; hero?: boolean }) {
  return hero ? (
    <div className="hex-dark relative overflow-hidden rounded-2xl bg-night p-5 text-night-ink sm:col-span-2">
      <span className="pole absolute inset-x-0 top-0 h-1.5" aria-hidden />
      <p className="pt-1 text-sm text-night-muted">{label}</p>
      <p className="font-display mt-1.5 text-6xl leading-none">{value}</p>
      {children ? <div className="mt-4 text-night-muted [&_.text-muted]:text-night-muted">{children}</div> : null}
    </div>
  ) : (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="font-display mt-1.5 text-4xl leading-none">{value}</p>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="hex-light rounded-xl border border-dashed border-line-strong bg-surface px-4 py-8 text-center text-sm text-muted">{children}</p>;
}

export const pctChange = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);
