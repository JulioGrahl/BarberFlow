import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, Clock, Scissors, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { brl, nowISO, spParts } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { WhatsAppLink } from "@/components/kit";
import { waLink } from "@/lib/whatsapp";

type Hour = { weekday: number; start_time: string; end_time: string; break_start: string | null; break_end: string | null };
const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const hm = (t: string) => t.slice(0, 5).replace(/^0/, "").replace(":00", "h").replace(":", "h");
type Props = { params: Promise<{ slug: string }> };

async function loadShop(slug: string) {
  const supabase = await createClient();
  const { data: shop } = await supabase.from("barbershops").select("id,name,slug,phone").eq("slug", slug).maybeSingle();
  if (!shop) return null;
  const [{ data: services }, { data: pros }, { data: hours }, { data: products }] = await Promise.all([
    supabase.from("services").select("id,name,description,price_cents,duration_minutes").eq("barbershop_id", shop.id).eq("active", true).order("price_cents"),
    supabase.from("professionals").select("id,display_name,photo_path").eq("barbershop_id", shop.id).eq("active", true).order("display_name"),
    supabase.rpc("get_public_hours", { p_shop: shop.id }),
    supabase.from("products").select("id,name,description,price_cents,photo_path").eq("barbershop_id", shop.id).eq("active", true).order("created_at", { ascending: false }).limit(24),
  ]);
  return { shop, services: services ?? [], pros: pros ?? [], hours: (hours ?? []) as Hour[], products: products ?? [] };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await loadShop((await params).slug);
  return { title: data?.shop.name ?? "Barbearia", description: data ? `Agende seu horário na ${data.shop.name}: serviços, preços e equipe.` : undefined };
}

// Página pública da barbearia (visível para anônimos graças à RLS: só barbearias com acesso liberado).
export default async function ShopPage({ params }: Props) {
  const data = await loadShop((await params).slug);
  if (!data) notFound();
  const { shop, services, pros, hours, products } = data;
  const open = new Map(hours.map((h) => [h.weekday, h]));
  const wa = waLink(shop.phone, `Olá! Vim pela página da ${shop.name}.`);
  const todayDow = new Date(`${spParts(nowISO()).ymd}T12:00:00Z`).getUTCDay();
  const todayHours = open.get(todayDow);
  const book = `/b/${shop.slug}/agendar`;
  const cheapest = services[0]?.price_cents;
  const faces = pros.filter((p) => p.photo_path).slice(0, 3);

  return (
    <div className="flex-1 pb-24 md:pb-0">
      {/* ---------- abertura */}
      <section className="relative overflow-hidden bg-night text-night-ink">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))] md:grid-cols-[1.3fr_1fr] md:items-end md:pb-20">
          <div>
            <div className="flex items-center justify-between md:justify-start">
              <span className="flex items-center gap-2.5 font-display text-lg text-night-muted"><span className="pole h-5 w-1.5 rounded-full" aria-hidden />Barbearia</span>
              <Link href="/login" className="rounded-lg border border-night-line px-3.5 py-2 text-sm hover:bg-night-2 md:hidden">Entrar</Link>
            </div>
            <h1 className="font-display rise mt-12 text-[3.4rem] leading-[0.92] sm:text-[5.5rem] lg:text-[7rem]">{shop.name}</h1>
            <div className="mt-6 flex flex-wrap items-center gap-2.5 text-sm">
              {hours.length > 0 ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-night-2 px-3.5 py-1.5">
                  <span className={`size-2 rounded-full ${todayHours ? "bg-success" : "bg-night-muted"}`} aria-hidden />
                  {todayHours ? `Aberto hoje, ${hm(todayHours.start_time)} às ${hm(todayHours.end_time)}` : "Fechado hoje"}
                </span>
              ) : null}
              {services.length > 0 && cheapest != null ? <span className="rounded-full bg-night-2 px-3.5 py-1.5">Serviços a partir de {brl(cheapest)}</span> : null}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={book} className="inline-flex min-h-13 items-center gap-2.5 rounded-xl bg-white px-7 py-3.5 text-lg font-semibold text-night transition hover:bg-night-ink active:translate-y-px"><CalendarCheck size={20} aria-hidden />Agendar horário</Link>
              {wa ? <WhatsAppLink href={wa} dark className="min-h-13 rounded-xl px-6 text-lg" /> : null}
            </div>
          </div>

          <aside className="hidden md:block" aria-label="Resumo">
            <div className="rounded-2xl border border-night-line bg-night-2 p-6">
              {faces.length > 0 ? (
                <div className="mb-5 flex -space-x-3">
                  {faces.map((p) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={p.id} src={mediaUrl(p.photo_path)!} alt={p.display_name} className="size-16 rounded-full border-4 border-night-2 object-cover" />
                  ))}
                </div>
              ) : null}
              <ul className="space-y-4 text-sm">
                <li className="flex items-center gap-3"><Scissors size={18} className="text-night-muted" aria-hidden /><span><strong className="font-display text-2xl">{services.length}</strong> <span className="text-night-muted">{services.length === 1 ? "serviço" : "serviços"}</span></span></li>
                <li className="flex items-center gap-3"><Users size={18} className="text-night-muted" aria-hidden /><span><strong className="font-display text-2xl">{pros.length}</strong> <span className="text-night-muted">{pros.length === 1 ? "profissional" : "profissionais"}</span></span></li>
                <li className="flex items-center gap-3"><Clock size={18} className="text-night-muted" aria-hidden /><span className="text-night-muted">Agendamento online, sem ligar</span></li>
              </ul>
              <Link href="/login" className="mt-6 block text-sm text-night-muted underline hover:text-white">Já tenho conta</Link>
            </div>
          </aside>
        </div>
        <span className="pole absolute inset-x-0 bottom-0 h-1.5" aria-hidden />
      </section>

      <main className="mx-auto w-full max-w-6xl space-y-16 px-5 py-14 md:space-y-20 md:py-20">
        {/* ---------- equipe */}
        {pros.length > 0 ? (
          <section aria-labelledby="equipe">
            <h2 id="equipe" className="font-display text-4xl leading-none sm:text-5xl">Quem atende</h2>
            <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {pros.map((p) => (
                <li key={p.id} className="group">
                  <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-night-2">
                    {p.photo_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaUrl(p.photo_path)!} alt={p.display_name} loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                    ) : (
                      <div className="flex size-full items-center justify-center bg-night text-night-line"><span className="font-display text-[6rem] leading-none">{p.display_name.slice(0, 1)}</span></div>
                    )}
                  </div>
                  <p className="font-display mt-3 text-2xl leading-tight">{p.display_name}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* ---------- serviços */}
        <section aria-labelledby="servicos">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="servicos" className="font-display text-4xl leading-none sm:text-5xl">Serviços e preços</h2>
            {services.length > 0 ? <Link href={book} className="inline-flex min-h-11 items-center rounded-lg bg-accent px-5 text-sm font-semibold text-accent-ink hover:bg-accent-hover">Agendar horário</Link> : null}
          </div>
          {services.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Esta barbearia ainda não cadastrou serviços.</p>
          ) : (
            <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((sv) => (
                <li key={sv.id} className="flex flex-col justify-between rounded-2xl border border-line bg-surface p-5">
                  <div>
                    <p className="font-display text-2xl leading-tight">{sv.name}</p>
                    {sv.description ? <p className="mt-1.5 text-sm text-muted">{sv.description}</p> : null}
                  </div>
                  <div className="mt-6 flex items-end justify-between">
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted"><Clock size={15} aria-hidden />{sv.duration_minutes} min</span>
                    <span className="font-display text-3xl leading-none">{brl(sv.price_cents)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------- vitrine (só aparece se o dono cadastrou produtos) */}
        {products.length > 0 ? (
          <section aria-labelledby="vitrine" className="-mx-5 bg-night px-5 py-14 text-night-ink sm:mx-0 sm:rounded-3xl sm:px-10">
            <h2 id="vitrine" className="font-display text-4xl leading-none sm:text-5xl">Na barbearia</h2>
            <p className="mt-3 max-w-xl text-night-muted">Produtos que usamos e vendemos no balcão. Pergunte ao seu barbeiro no atendimento.</p>
            <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <li key={p.id} className="overflow-hidden rounded-2xl bg-night-2">
                  <div className="aspect-square bg-night">
                    {p.photo_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaUrl(p.photo_path)!} alt={p.name} loading="lazy" className="size-full object-cover" />
                    ) : <div className="flex size-full items-center justify-center text-night-line"><span className="font-display text-7xl">{p.name.slice(0, 1)}</span></div>}
                  </div>
                  <div className="p-4">
                    <p className="font-display text-xl leading-tight">{p.name}</p>
                    {p.description ? <p className="mt-1 line-clamp-2 text-sm text-night-muted">{p.description}</p> : null}
                    {p.price_cents != null ? <p className="font-display mt-2 text-2xl text-flare">{brl(p.price_cents)}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* ---------- horários e contato */}
        {hours.length > 0 ? (
          <section aria-labelledby="horarios" className="grid gap-8 md:grid-cols-[1fr_1.2fr] md:gap-14">
            <div>
              <h2 id="horarios" className="font-display text-4xl leading-none sm:text-5xl">Horários</h2>
              <p className="mt-3 text-muted">Escolha o dia e o profissional na hora de agendar. Só aparecem horários livres.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={book} className="inline-flex min-h-12 items-center rounded-xl bg-accent px-6 font-semibold text-accent-ink hover:bg-accent-hover">Agendar horário</Link>
                {wa ? <WhatsAppLink href={wa} className="min-h-12 rounded-xl px-5" /> : null}
              </div>
            </div>
            <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                const h = open.get(d);
                const now = d === todayDow;
                return (
                  <li key={d} className={`flex justify-between gap-4 border-b border-line px-5 py-3 last:border-0 ${now ? "bg-night font-medium text-night-ink" : ""}`}>
                    <span>{DAYS[d]}{now ? " · hoje" : ""}</span>
                    <span className={`text-right tabular-nums ${h ? "" : now ? "text-night-muted" : "text-muted"}`}>{h ? `${hm(h.start_time)} às ${hm(h.end_time)}${h.break_start && h.break_end ? ` · pausa ${hm(h.break_start)} às ${hm(h.break_end)}` : ""}` : "Fechado"}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </main>

      <footer className="border-t border-line px-5 py-8 text-center text-sm text-muted">
        <p>{shop.name} · agendamento por <span className="font-semibold text-ink">BarberFlow</span></p>
        <p className="mt-1">Para agendar você cria uma conta gratuita em menos de um minuto. <Link href="/login" className="underline hover:text-ink">Já tenho conta</Link></p>
      </footer>

      {/* barra de ação fixa no celular */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-night-line bg-night p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
        <Link href={book} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white font-semibold text-night"><CalendarCheck size={19} aria-hidden />Agendar horário</Link>
      </div>
    </div>
  );
}
