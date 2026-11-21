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
  const side = (on: boolean) => `relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${on ? "bg-night-2 font-medium text-white" : "text-night-muted hover:bg-night-2/60 hover:text-night-ink"}`;
  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-night px-3 py-5 pl-5 text-night-ink md:flex">
        <div className="mb-8 px-3"><p className="font-display text-2xl leading-tight">BarberFlow</p><p className="mt-0.5 text-xs text-night-muted">Administração</p></div>
        <nav className="flex flex-1 flex-col gap-0.5">
          {items.map(({ href, label, icon: Icon, exact }) => {
            const on = active(href, exact);
            return (
              <Link key={href} href={href} aria-current={on ? "page" : undefined} className={side(on)}>
                <Icon size={18} aria-hidden className={on ? "text-flare" : ""} /> {label}
              </Link>
            );
          })}
        </nav>
        <form action="/auth/signout" method="post" className="border-t border-night-line pt-3">
          <button className={`${side(false)} w-full`}><LogOut size={18} aria-hidden /> Sair</button>
        </form>
      </aside>
      <header className="sticky top-0 z-30 flex items-center justify-between bg-night px-4 pb-3.5 pt-[max(0.75rem,env(safe-area-inset-top))] text-night-ink md:hidden">
        <p className="font-display text-2xl">BarberFlow</p>
        <form action="/auth/signout" method="post"><button aria-label="Sair" className="rounded-lg p-2 text-night-muted hover:text-white"><LogOut size={18} /></button></form>
      </header>
      <nav className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 grid grid-cols-3 gap-1 rounded-2xl bg-night p-1.5 shadow-[0_12px_32px_rgb(14_27_37/.35)] md:hidden" aria-label="Principal">
        {items.map(({ href, label, icon: Icon, exact }) => (
          <Link key={href} href={href} aria-current={active(href, exact) ? "page" : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-xs ${active(href, exact) ? "bg-night-2 font-medium text-white" : "text-night-muted"}`}><Icon size={21} aria-hidden className={active(href, exact) ? "text-flare" : ""} /> {label}</Link>
        ))}
      </nav>
    </>
  );
}
