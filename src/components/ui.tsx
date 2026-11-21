"use client";

import { useFormStatus } from "react-dom";
import type { InputHTMLAttributes, ReactNode } from "react";

// Moldura das telas de entrada: placa escura com azulejo à esquerda (desktop) e o formulário à direita.
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="grid flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="hex-dark relative hidden overflow-hidden bg-night p-12 text-night-ink lg:flex lg:flex-col lg:justify-between">
        <span className="pole absolute inset-y-0 left-0 w-3" aria-hidden />
        <div className="flex items-center gap-3 pl-4"><span className="pole pole-animate h-8 w-2.5 rounded-full" aria-hidden /><span className="font-display text-2xl">BarberFlow</span></div>
        <p className="font-display pl-4 text-6xl leading-[0.95]">A cadeira cheia e o caixa em dia.</p>
        <p className="max-w-sm pl-4 text-sm text-night-muted">Agenda, equipe e financeiro da barbearia em um só lugar.</p>
      </aside>
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden"><span className="pole pole-animate h-7 w-2.5 rounded-full" aria-hidden /><span className="font-display text-2xl">BarberFlow</span></div>
          <h1 className="font-display text-5xl leading-none">{title}</h1>
          {subtitle ? <p className="mt-3 text-sm text-muted">{subtitle}</p> : null}
          <div className="mt-7 rounded-2xl border border-line bg-surface p-5 sm:p-6">{children}</div>
        </div>
      </div>
    </main>
  );
}

export function Field({ label, id, ...props }: { label: string; id: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={id}
        className="w-full rounded-lg border px-3.5 py-3 text-base text-ink placeholder:text-muted/60"
        {...props}
      />
    </div>
  );
}

export function SubmitButton({ children, pendingText = "Aguarde...", tone }: { children: ReactNode; pendingText?: string; tone?: "danger" | "ink" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`min-h-12 w-full rounded-lg px-4 py-2.5 font-semibold text-white transition active:translate-y-px disabled:opacity-60 ${tone === "danger" ? "bg-danger hover:brightness-110" : tone === "ink" ? "bg-night hover:bg-night-2" : "bg-accent hover:bg-accent-hover"}`}
    >
      {pending ? pendingText : children}
    </button>
  );
}

export function FormMessage({ error, message }: { error?: string; message?: string }) {
  if (!error && !message) return null;
  return (
    <p
      role={error ? "alert" : "status"}
      className={`rounded-lg border px-3.5 py-2.5 text-sm ${
        error ? "border-danger/30 bg-danger-bg text-danger" : "border-success/30 bg-success-bg text-success"
      }`}
    >
      {error ?? message}
    </p>
  );
}
