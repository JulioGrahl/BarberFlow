"use client";

export function ClearBreak({ day }: { day: number }) {
  return (
    <button type="button" className="rounded-md px-2 py-1 text-sm text-ink underline decoration-line-strong underline-offset-2 hover:bg-surface-2"
      onClick={(e) => {
        const f = e.currentTarget.form;
        if (!f) return;
        for (const k of [`bs_${day}`, `be_${day}`]) { const el = f.elements.namedItem(k); if (el instanceof HTMLInputElement) el.value = ""; }
      }}>Sem intervalo</button>
  );
}
