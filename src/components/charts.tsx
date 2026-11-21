"use client";

import { useId, useRef, useState } from "react";

export type Series = { name: string; color: string; values: number[] };

const W = 640, H = 230, PL = 8, PR = 8, PT = 14, PB = 26;

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

// Área/linha com mira e tooltip. Uma série = área preenchida; duas ou mais = linhas.
export function AreaChart({ labels, series, format, tickEvery = 5 }: { labels: string[]; series: Series[]; format: (n: number) => string; tickEvery?: number }) {
  const id = useId();
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const x = (i: number) => PL + (n <= 1 ? 0 : (i / (n - 1)) * (W - PL - PR));
  const y = (v: number) => PT + (1 - v / max) * (H - PT - PB);
  const path = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const grid = [0, 0.5, 1].map((f) => f * max);
  const single = series.length === 1;

  function onMove(e: React.PointerEvent) {
    const r = ref.current?.getBoundingClientRect();
    if (!r || n === 0) return;
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - PL) / (W - PL - PR)) * (n - 1)))));
  }

  return (
    <div className="relative">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full touch-pan-y" role="img" aria-label={series.map((s) => s.name).join(" e ")}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={i} id={`${id}-g${i}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={s.color} stopOpacity=".38" /><stop offset="1" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {grid.map((g) => (
          <g key={g}>
            <line x1={PL} x2={W - PR} y1={y(g)} y2={y(g)} stroke="var(--bf-border)" strokeWidth="1" strokeDasharray={g === 0 ? undefined : "2 4"} />
            {g > 0 ? <text x={PL} y={y(g) - 4} fontSize="10" fill="var(--bf-muted)">{format(g)}</text> : null}
          </g>
        ))}
        {labels.map((l, i) => (i % tickEvery === 0 || i === n - 1 ? <text key={i} x={x(i)} y={H - 8} fontSize="10" fill="var(--bf-muted)" textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>{l}</text> : null))}
        {series.map((s, i) => (
          <g key={s.name}>
            {single ? <path d={`${path(s.values)} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#${id}-g${i})`} /> : null}
            <path d={path(s.values)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </g>
        ))}
        {hover !== null ? (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PT} y2={H - PB} stroke="var(--bf-muted)" strokeWidth="1" />
            {series.map((s) => <circle key={s.name} cx={x(hover)} cy={y(s.values[hover])} r="4.5" fill={s.color} stroke="var(--bf-surface)" strokeWidth="2" />)}
          </g>
        ) : null}
      </svg>
      {hover !== null ? (
        <div className="pointer-events-none absolute top-1 z-10 min-w-32 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs shadow-lg"
          style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > n * 0.6 ? "-105%" : "8%"})` }}>
          <p className="mb-1 text-muted">{labels[hover]}</p>
          {series.map((s) => (
            <p key={s.name} className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ background: s.color }} />
              <span className="text-muted">{s.name}</span>
              <span className="ml-auto font-medium text-ink">{format(s.values[hover])}</span>
            </p>
          ))}
        </div>
      ) : null}
      {series.length > 1 ? (
        <div className="mt-2 flex gap-4 text-xs text-muted">
          {series.map((s) => <span key={s.name} className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: s.color }} />{s.name}</span>)}
        </div>
      ) : null}
    </div>
  );
}

// Mapa de calor semana × hora (uma matiz, claro → escuro = menos → mais)
export function Heatmap({ rows, hours, rowLabels, unit }: { rows: number[][]; hours: number[]; rowLabels: string[]; unit: string }) {
  const [tip, setTip] = useState<string | null>(null);
  const max = Math.max(1, ...rows.flat());
  return (
    <div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[30rem] gap-[3px]" style={{ gridTemplateColumns: `2.2rem repeat(${hours.length}, minmax(0,1fr))` }}>
          <span />
          {hours.map((h) => <span key={h} className="text-center text-[10px] text-muted">{h}h</span>)}
          {rows.map((r, d) => (
            <div key={d} className="contents">
              <span className="self-center text-xs text-muted">{rowLabels[d]}</span>
              {r.map((v, i) => (
                <button key={i} type="button" aria-label={`${rowLabels[d]} ${hours[i]}h: ${v} ${unit}`}
                  onMouseEnter={() => setTip(`${rowLabels[d]}, ${hours[i]}h: ${v} ${unit}`)} onFocus={() => setTip(`${rowLabels[d]}, ${hours[i]}h: ${v} ${unit}`)}
                  onMouseLeave={() => setTip(null)} onBlur={() => setTip(null)}
                  className="aspect-[1.3] rounded-[3px] outline-offset-1 hover:outline hover:outline-1 hover:outline-ink/70"
                  style={{ background: v === 0 ? "var(--bf-surface-2)" : `color-mix(in srgb, #b98a2e ${Math.round(25 + (v / max) * 75)}%, var(--bf-surface-2))` }} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 h-4 text-xs text-muted" aria-live="polite">{tip ?? "Passe o mouse sobre um bloco."}</p>
    </div>
  );
}

// Barras horizontais para rankings; o valor fica ao lado, a barra mostra a proporção.
export function HBars({ items, color = "var(--c1)" }: { items: { label: string; value: number; text: string; hint?: string }[]; color?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.label} title={it.hint ?? `${it.label}: ${it.text}`} className="group">
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="truncate">{it.label}</span>
            <span className="shrink-0 text-muted group-hover:text-ink">{it.text}</span>
          </div>
          <div className="h-2 rounded-full bg-surface-2">
            <div className="h-full rounded-full transition-[filter] group-hover:brightness-125" style={{ width: `${Math.max(3, (it.value / max) * 100)}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Sparkline({ values, color = "var(--c1)" }: { values: number[]; color?: string }) {
  const max = Math.max(1, ...values), n = values.length;
  const d = values.map((v, i) => `${i ? "L" : "M"}${((i / Math.max(1, n - 1)) * 100).toFixed(1)},${(22 - (v / max) * 20).toFixed(1)}`).join(" ");
  return <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="h-6 w-full" aria-hidden><path d={d} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
