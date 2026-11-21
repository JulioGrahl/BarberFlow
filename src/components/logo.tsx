// Marca da BarberFlow: poste de barbeiro (SVG) + nome. Fonte única; os arquivos em /public (logo-*.svg, ícones do PWA) saem do mesmo desenho.
const RED = "#d2372b";
const BLUE = "#2a5da8";
const WHITE = "#f6f8f8";

const bands = [-2, -1, 0, 1, 2, 3].flatMap((n) => {
  const y = 32 * n;
  return [
    <polygon key={`r${n}`} fill={RED} points={`-2,${y + 1} 26,${y - 9} 26,${y - 1} -2,${y + 9}`} />,
    <polygon key={`b${n}`} fill={BLUE} points={`-2,${y + 17} 26,${y + 7} 26,${y + 15} -2,${y + 25}`} />,
  ];
});

/** Só o poste. `animate` faz as listras girarem (use em carregamento ou num destaque, nunca em vários lugares ao mesmo tempo). */
export function LogoMark({ className = "h-8", animate = false }: { className?: string; animate?: boolean }) {
  return (
    <svg viewBox="0 0 24 48" className={`${className} w-auto shrink-0`} aria-hidden focusable="false">
      <defs>
        <clipPath id="bf-tube"><rect x="5" y="5" width="14" height="38" rx="7" /></clipPath>
        <linearGradient id="bf-glass" x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".35" />
          <stop offset=".45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".18" />
        </linearGradient>
      </defs>
      <rect x="4.5" y="0.5" width="15" height="6" rx="2" fill="#cdd8df" />
      <rect x="4.5" y="41.5" width="15" height="6" rx="2" fill="#cdd8df" />
      <g clipPath="url(#bf-tube)">
        <rect x="5" y="5" width="14" height="38" fill={WHITE} />
        <g className={animate ? "bf-bands" : undefined}>{bands}</g>
        <rect x="5" y="5" width="14" height="38" fill="url(#bf-glass)" />
      </g>
    </svg>
  );
}

const SIZES = {
  sm: { mark: "h-7", text: "text-xl" },   // cabeçalhos mobile, rodapés
  md: { mark: "h-8", text: "text-2xl" },  // cabeçalhos desktop, LP
  lg: { mark: "h-10", text: "text-3xl" }, // destaque (painel do login)
} as const;

/** Poste + nome, em três tamanhos fixos. `tone="dark"` = fundo escuro (texto claro); `tone="light"` = fundo claro. */
export function Logo({ tone = "dark", size = "md", animate = false }: { tone?: "dark" | "light"; size?: keyof typeof SIZES; animate?: boolean }) {
  const s = SIZES[size];
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark className={s.mark} animate={animate} />
      <span className={`font-display leading-none ${s.text} ${tone === "dark" ? "text-night-ink" : "text-ink"}`}>BarberFlow</span>
    </span>
  );
}
