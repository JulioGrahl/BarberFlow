"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CreditCard, LayoutDashboard, LogOut } from "lucide-react";

const items = [
  { href: "/master", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { href: "/master/barbearias", label: "Barbearias", icon: Building2 },
  { href: "/master/planos", label: "Planos", icon: CreditCard },
];

export function MasterNav() {
  const path = usePathname();
  const active = (href: string, exact?: boolean) => (exact ? path === href : path.startsWith(href));
  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface px-3 py-5 md:flex">
        <div className="mb-8 flex items-center gap-3 px-3">
          <span className="pole pole-animate h-9 w-2.5 shrink-0 rounded-full" aria-hidden />
          <div><p className="font-display text-lg leading-tight">BarberFlow</p><p className="text-xs text-muted">Administração</p></div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5">
          {items.map(({ href, label, icon: Icon, exact }) => {
            const on = active(href, exact);
            return (
              <Link key={href} href={href} aria-current={on ? "page" : undefined}
                className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${on ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2/60 hover:text-ink"}`}>
                {on ? <span className="pole absolute inset-y-2 left-0 w-[3px] rounded-full" aria-hidden /> : null}
                <Icon size={18} aria-hidden className={on ? "text-accent" : ""} /> {label}
              </Link>
            );
          })}
        </nav>
        <form action="/auth/signout" method="post" className="border-t border-line pt-3">
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted hover:bg-surface-2/60 hover:text-ink"><LogOut size={18} aria-hidden /> Sair</button>
        </form>
      </aside>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-2.5"><span className="pole h-6 w-2 rounded-full" aria-hidden /><p className="font-display text-lg">BarberFlow</p></div>
        <form action="/auth/signout" method="post"><button aria-label="Sair" className="rounded-lg p-2 text-muted hover:text-ink"><LogOut size={18} /></button></form>
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Principal">
        {items.map(({ href, label, icon: Icon, exact }) => (
          <Link key={href} href={href} aria-current={active(href, exact) ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] ${active(href, exact) ? "text-accent" : "text-muted"}`}><Icon size={20} aria-hidden /> {label}</Link>
        ))}
      </nav>
    </>
  );
}
