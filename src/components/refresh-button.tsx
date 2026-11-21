"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

// Atualiza os dados da tela sem recarregar a página inteira (útil com o app aberto o dia todo).
export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [at, setAt] = useState<string | null>(null);
  return (
    <button type="button" disabled={pending} aria-busy={pending}
      onClick={() => start(() => { router.refresh(); setAt(new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })); })}
      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm text-muted hover:text-ink disabled:opacity-60">
      <RefreshCw size={16} aria-hidden className={pending ? "animate-spin" : ""} />
      {pending ? "Atualizando…" : at ? `Atualizado ${at}` : "Atualizar"}
    </button>
  );
}
