"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CalendarDays, Clock, Wallet, MessageCircle, LogOut, Scissors, Users, ExternalLink, Sun, ChartNoAxesCombined, Menu, X } from "lucide-react";

export function ShopNav({ slug, owner, name, pending = 0 }: { slug: string; owner: boolean; name: string; pending?: number }) {
  const path = usePathname();
  const [more, setMore] = useState(false);
  const base = `/painel/${slug}`;
  const items = [
    { href: base, label: "Hoje", icon: Sun, exact: true },
    { href: `${base}/agenda`, label: "Agenda", icon: CalendarDays },
    { href: `${base}/financeiro`, label: owner ? "Financeiro" : "Meus ganhos", icon: Wallet },
    { href: `${base}/resumo`, label: "Resumo", icon: ChartNoAxesCombined },
    ...(owner
      ? [
          { href: `${base}/servicos`, label: "Serviços", icon: Scissors },
          { href: `${base}/profissionais`, label: "Equipe", icon: Users },
          { href: `${base}/horarios`, label: "Horários", icon: Clock },
          { href: `${base}/lembretes`, label: "Lembretes", icon: MessageCircle },
        ]
      : []),
  ];
  const main = items.filter((i) => [base, `${base}/agenda`, `${base}/financeiro`].includes(i.href));
  const rest = items.filter((i) => !main.includes(i));
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
                {exact && pending > 0 ? <span className="ml-auto rounded-full bg-warn px-1.5 text-xs font-semibold text-accent-ink" aria-label={`${pending} para fechar`}>{pending}</span> : null}
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
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Principal">
        {main.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined}
              className={`relative flex min-h-16 flex-col items-center justify-center gap-1 text-xs ${active ? "text-accent" : "text-muted"}`}>
              <span className="relative"><Icon size={22} aria-hidden />
                {exact && pending > 0 ? <span className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-warn px-1 text-center text-[10px] font-bold leading-4 text-accent-ink" aria-label={`${pending} para fechar`}>{pending}</span> : null}
              </span>
              {label}
            </Link>
          );
        })}
        <button type="button" onClick={() => setMore(true)} aria-haspopup="dialog" className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs ${rest.some((r) => isActive(r.href)) ? "text-accent" : "text-muted"}`}>
          <Menu size={22} aria-hidden /> Mais
        </button>
      </nav>
      {more ? (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Mais opções">
          <button type="button" aria-label="Fechar" className="absolute inset-0 bg-black/60" onClick={() => setMore(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-line bg-surface px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="font-display text-lg">{name}</p>
              <button type="button" onClick={() => setMore(false)} aria-label="Fechar" className="rounded-lg p-2 text-muted"><X size={20} /></button>
            </div>
            <div className="grid gap-1">
              {rest.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} onClick={() => setMore(false)} className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-base ${isActive(href) ? "bg-surface-2 text-accent" : ""}`}><Icon size={20} aria-hidden /> {label}</Link>
              ))}
              <Link href={`/b/${slug}`} target="_blank" className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-base"><ExternalLink size={20} aria-hidden /> Página pública</Link>
              <form action="/auth/signout" method="post"><button className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-base text-muted"><LogOut size={20} aria-hidden /> Sair</button></form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
