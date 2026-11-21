"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CalendarDays, Clock, Wallet, MessageCircle, LogOut, Scissors, Users, ExternalLink, Sun, ChartNoAxesCombined, ContactRound, Menu, X } from "lucide-react";

export function ShopNav({ slug, owner, name, pending = 0 }: { slug: string; owner: boolean; name: string; pending?: number }) {
  const path = usePathname();
  const [more, setMore] = useState(false);
  const base = `/painel/${slug}`;
  const items = [
    { href: base, label: "Hoje", icon: Sun, exact: true },
    { href: `${base}/agenda`, label: "Agenda", icon: CalendarDays },
    { href: `${base}/financeiro`, label: owner ? "Financeiro" : "Meus ganhos", icon: Wallet },
    { href: `${base}/resumo`, label: owner ? "Resumo" : "Meu resumo", icon: ChartNoAxesCombined },
    ...(owner
      ? [
          { href: `${base}/clientes`, label: "Clientes", icon: ContactRound },
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

  const side = (on: boolean) => `relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${on ? "bg-night-2 font-semibold text-white shadow-[inset_3px_0_0_var(--bf-blue)]" : "text-night-muted hover:bg-night-2/60 hover:text-night-ink"}`;

  return (
    <>
      {/* Desktop: placa escura com o poste na borda */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-night px-3 py-5 text-night-ink md:flex">
        <div className="mb-8 flex items-center gap-3 px-3">
          <span className="pole h-9 w-1.5 shrink-0 rounded-full" aria-hidden />
          <div className="min-w-0">
            <p className="font-display truncate text-xl leading-tight">{name}</p>
            <p className="mt-0.5 text-xs text-night-muted">{owner ? "Proprietário" : "Barbeiro"}</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5">
          {items.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined} className={side(active)}>
                <Icon size={18} aria-hidden className={active ? "text-white" : ""} /> {label}
                {exact && pending > 0 ? <span className="ml-auto rounded-full bg-danger px-1.5 text-xs font-semibold text-white" aria-label={`${pending} para fechar`}>{pending}</span> : null}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-0.5 border-t border-night-line pt-3">
          <Link href={`/b/${slug}`} target="_blank" className={side(false)}>
            <ExternalLink size={18} aria-hidden /> Página pública
          </Link>
          <form action="/auth/signout" method="post">
            <button className={`${side(false)} w-full`}>
              <LogOut size={18} aria-hidden /> Sair
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-night px-4 pb-3.5 pt-[max(0.75rem,env(safe-area-inset-top))] text-night-ink md:hidden">
        <p className="font-display truncate text-2xl">{name}</p>
        <form action="/auth/signout" method="post"><button aria-label="Sair" className="rounded-lg p-2 text-night-muted hover:text-white"><LogOut size={18} /></button></form>
      </header>
      <nav className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 grid grid-cols-4 gap-1 rounded-2xl bg-night p-1.5 shadow-[0_12px_32px_rgb(14_27_37/.35)] md:hidden" aria-label="Principal">
        {main.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined}
              className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-xs ${active ? "bg-night-2 font-medium text-white" : "text-night-muted"}`}>
              <span className="relative"><Icon size={21} aria-hidden className={active ? "text-flare" : ""} />
                {exact && pending > 0 ? <span className="absolute -right-3 -top-1.5 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-4 text-white" aria-label={`${pending} para fechar`}>{pending}</span> : null}
              </span>
              {label}
            </Link>
          );
        })}
        <button type="button" onClick={() => setMore(true)} aria-haspopup="dialog" className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-xs ${rest.some((r) => isActive(r.href)) ? "bg-night-2 font-medium text-white" : "text-night-muted"}`}>
          <Menu size={21} aria-hidden className={rest.some((r) => isActive(r.href)) ? "text-flare" : ""} /> Mais
        </button>
      </nav>
      {more ? (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Mais opções">
          <button type="button" aria-label="Fechar" className="absolute inset-0 bg-night/60" onClick={() => setMore(false)} />
          <div className="absolute inset-x-0 bottom-0 overflow-hidden rounded-t-3xl bg-surface px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            <div className="mb-2 flex items-center justify-between px-2 pt-1">
              <p className="font-display text-2xl">{name}</p>
              <button type="button" onClick={() => setMore(false)} aria-label="Fechar" className="rounded-lg p-2 text-muted"><X size={20} /></button>
            </div>
            <div className="grid gap-1">
              {rest.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} onClick={() => setMore(false)} className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-base ${isActive(href) ? "bg-night font-medium text-white" : ""}`}><Icon size={20} aria-hidden className={isActive(href) ? "text-flare" : "text-muted"} /> {label}</Link>
              ))}
              <Link href={`/b/${slug}`} target="_blank" className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-base"><ExternalLink size={20} aria-hidden className="text-muted" /> Página pública</Link>
              <form action="/auth/signout" method="post"><button className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-base text-muted"><LogOut size={20} aria-hidden /> Sair</button></form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
