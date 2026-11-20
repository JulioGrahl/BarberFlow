"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CreditCard, LayoutDashboard, LogOut } from "lucide-react";

const items = [
  { href: "/master", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/master/barbearias", label: "Barbearias", icon: Building2 },
  { href: "/master/planos", label: "Planos", icon: CreditCard },
];

export function MasterNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 md:flex-col">
      {items.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? path === href : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${
              active ? "bg-surface-2 text-accent" : "text-muted hover:bg-surface hover:text-ink"
            }`}
          >
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
