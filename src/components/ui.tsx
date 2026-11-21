"use client";

import { useFormStatus } from "react-dom";
import type { InputHTMLAttributes, ReactNode } from "react";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-2.5"><span className="pole pole-animate h-6 w-2 rounded-full" aria-hidden /><span className="font-display text-xl">BarberFlow</span></div>
        <h1 className="font-display text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

export function Field({ label, id, ...props }: { label: string; id: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm text-muted">
        {label}
      </label>
      <input
        id={id}
        name={id}
        className="w-full rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-base text-ink placeholder:text-muted/60"
        {...props}
      />
    </div>
  );
}

export function SubmitButton({ children, pendingText = "Aguarde..." }: { children: ReactNode; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-60"
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
        error ? "border-danger/40 text-danger" : "border-success/40 text-success"
      }`}
    >
      {error ?? message}
    </p>
  );
}
