"use client";

export function ClearBreak({ day }: { day: number }) {
  return (
    <button type="button" className="rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-ink"
      onClick={(e) => {
        const f = e.currentTarget.form;
        if (!f) return;
        for (const k of [`bs_${day}`, `be_${day}`]) { const el = f.elements.namedItem(k); if (el instanceof HTMLInputElement) el.value = ""; }
      }}>Sem intervalo</button>
  );
}
