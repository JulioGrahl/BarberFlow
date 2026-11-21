// Esqueleto de carregamento: aparece na hora ao trocar de tela, enquanto o servidor monta a página de verdade.
export function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-line/70 motion-reduce:animate-none ${className}`} aria-hidden />;
}

export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-2xl lg:max-w-5xl" role="status" aria-live="polite" aria-label="Carregando">
      <Bone className="h-12 w-56 max-w-full" />
      <Bone className="mt-3 h-4 w-72 max-w-full" />
      <Bone className="mt-6 h-44 w-full rounded-2xl" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Bone className="h-28 rounded-2xl" /><Bone className="h-28 rounded-2xl" /><Bone className="h-28 rounded-2xl" />
      </div>
      <Bone className="mt-4 h-56 w-full rounded-2xl" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
