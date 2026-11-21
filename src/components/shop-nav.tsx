"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Clock, Wallet, LayoutDashboard, MessageCircle, LogOut, Scissors, Users, ExternalLink } from "lucide-react";

export function ShopNav({ slug, owner, name }: { slug: string; owner: boolean; name: string }) {
  const path = usePathname();
  const base = `/painel/${slug}`;
  const items = [
    { href: base, label: "Início", icon: LayoutDashboard, exact: true },
    { href: `${base}/agenda`, label: "Agenda", icon: CalendarDays },
    { href: `${base}/financeiro`, label: owner ? "Financeiro" : "Meus ganhos", icon: Wallet },
    ...(owner
      ? [
          { href: `${base}/servicos`, label: "Serviços", icon: Scissors },
          { href: `${base}/profissionais`, label: "Equipe", icon: Users },
          { href: `${base}/horarios`, label: "Horários", icon: Clock },
          { href: `${base}/lembretes`, label: "Lembretes", icon: MessageCircle },
        ]
      : []),
  ];
  const isActive = (href: string, exact?: boolean) => (exact ? path === href : path.startsWith(href));

  return (
    <>
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface px-3 py-5 md:flex">
        <div className="mb-8 flex items-center gap-3 px-3">
          <span className="pole pole-animate h-9 w-2.5 shrink-0 rounded-full" aria-hidden />
          <div className="min-w-0">
            <p className="font-display truncate text-lg leading-tight">{name}</p>
            <p className="text-xs text-muted">{owner ? "Proprietário" : "Barbeiro"}</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5">
          {items.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined}
                className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${active ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2/60 hover:text-ink"}`}>
                {active ? <span className="pole absolute inset-y-2 left-0 w-[3px] rounded-full" aria-hidden /> : null}
                <Icon size={18} aria-hidden className={active ? "text-accent" : ""} /> {label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-0.5 border-t border-line pt-3">
          <Link href={`/b/${slug}`} target="_blank" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted hover:bg-surface-2/60 hover:text-ink">
            <ExternalLink size={18} aria-hidden /> Página pública
          </Link>
          <form action="/auth/signout" method="post">
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted hover:bg-surface-2/60 hover:text-ink">
              <LogOut size={18} aria-hidden /> Sair
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="pole h-6 w-2 shrink-0 rounded-full" aria-hidden />
          <p className="font-display truncate text-lg">{name}</p>
        </div>
        <form action="/auth/signout" method="post"><button aria-label="Sair" className="rounded-lg p-2 text-muted hover:text-ink"><LogOut size={18} /></button></form>
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-line bg-surface/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Principal">
        {items.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined}
              className={`flex min-w-[4.5rem] flex-1 flex-col items-center gap-1 px-2 py-2.5 text-[11px] ${active ? "text-accent" : "text-muted"}`}>
              <Icon size={20} aria-hidden /> {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
