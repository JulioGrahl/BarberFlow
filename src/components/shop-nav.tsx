"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Clock, LayoutDashboard, LogOut, Scissors, Users } from "lucide-react";

export function ShopNav({ slug, owner }: { slug: string; owner: boolean }) {
  const path = usePathname();
  const base = `/painel/${slug}`;
  const items = [
    { href: base, label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: `${base}/agenda`, label: "Agenda", icon: CalendarDays },
    ...(owner
      ? [
          { href: `${base}/servicos`, label: "Serviços", icon: Scissors },
          { href: `${base}/profissionais`, label: "Profissionais", icon: Users },
          { href: `${base}/horarios`, label: "Horários", icon: Clock },
        ]
      : []),
  ];
  return (
    <nav className="flex gap-1 md:flex-col">
      {items.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? path === href : path.startsWith(href);
        return (
          <Link key={href} href={href} className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${active ? "bg-surface-2 text-accent" : "text-muted hover:bg-surface hover:text-ink"}`}>
            <Icon size={18} aria-hidden /> {label}
          </Link>
        );
      })}
      <form action="/auth/signout" method="post" className="md:mt-6">
        <button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted hover:bg-surface hover:text-ink">
          <LogOut size={18} aria-hidden /> Sair
        </button>
      </form>
    </nav>
  );
}
