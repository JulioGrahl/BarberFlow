"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import type { MasterState } from "@/app/actions/master";
import { FormMessage, SubmitButton } from "@/components/ui";
import { useDrawer } from "@/components/drawer";

export const inputCls = "w-full rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-base text-ink placeholder:text-muted/60";

export function L({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-muted">{label}</span>
      {children}
    </label>
  );
}

function CopyLink({ url }: { url: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="space-y-2 rounded-xl border border-accent/40 bg-surface-2 p-3">
      <p className="break-all text-sm">{url}</p>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setOk(true);
          } catch {
            /* sem permissão de área de transferência: o usuário copia manualmente */
          }
        }}
        className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-surface"
      >
        {ok ? <Check size={16} /> : <Copy size={16} />} {ok ? "Copiado" : "Copiar link"}
      </button>
      <p className="text-xs text-muted">Este link só aparece agora. Se perder, gere outro na página da barbearia.</p>
    </div>
  );
}

// Formulário genérico: recebe a server action e os campos como children.
export function ActionForm({
  action, children, submit, pending, className = "space-y-4",
}: {
  action: (prev: MasterState, fd: FormData) => Promise<MasterState>;
  children: ReactNode;
  submit: string;
  pending?: string;
  className?: string;
}) {
  const [state, run] = useActionState<MasterState, FormData>(action, undefined);
  const drawer = useDrawer();
  const [seen, setSeen] = useState<MasterState>(undefined);
  const toast = state?.message && !state.error && !state.inviteUrl && seen !== state ? state.message : null;
  useEffect(() => {
    if (!state?.message || state.error) return;
    if (!state.inviteUrl) drawer?.close();
    const t = setTimeout(() => setSeen(state), 3500);
    return () => clearTimeout(t);
  }, [state, drawer]);
  return (
    <form action={run} className={className}>
      {children}
      <FormMessage error={state?.error} message={state?.inviteUrl ? state.message : undefined} />
      {toast ? <div role="status" className="toast-in fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-success/40 bg-surface-2 px-4 py-2.5 text-sm text-success shadow-xl md:bottom-6">{toast}</div> : null}
      {state?.inviteUrl ? <CopyLink url={state.inviteUrl} /> : null}
      <SubmitButton pendingText={pending}>{submit}</SubmitButton>
    </form>
  );
}
