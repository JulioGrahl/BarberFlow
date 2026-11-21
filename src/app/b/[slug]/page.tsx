import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, Clock, Scissors, UserPlus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { brl, nowISO, spParts } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { WhatsAppLink } from "@/components/kit";
import { waLink } from "@/lib/whatsapp";
import { getUser, resolveHome } from "@/lib/auth";
import { GalleryCarousel } from "@/components/gallery-carousel";
import { SocialIcon, SOCIAL_LABEL } from "@/components/social-icons";
import type { SocialKey } from "@/lib/social";
import { Logo, LogoMark } from "@/components/logo";

type Hour = { weekday: number; start_time: string; end_time: string; break_start: string | null; break_end: string | null };
const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const hm = (t: string) => t.slice(0, 5).replace(/^0/, "").replace(":00", "h").replace(":", "h");
type Props = { params: Promise<{ slug: string }> };

async function loadShop(slug: string) {
  const supabase = await createClient();
  const { data: shop } = await supabase.from("barbershops").select("id,name,slug,phone").eq("slug", slug).maybeSingle();
  if (!shop) return null;
  const [{ data: services }, { data: pros }, { data: hours }, { data: products }, { data: cfg }, { data: gallery }] = await Promise.all([
    supabase.from("services").select("id,name,description,price_cents,duration_minutes").eq("barbershop_id", shop.id).eq("active", true).order("price_cents"),
    supabase.from("professionals").select("id,display_name,photo_path").eq("barbershop_id", shop.id).eq("active", true).order("display_name"),
    supabase.rpc("get_public_hours", { p_shop: shop.id }),
    supabase.from("products").select("id,name,description,price_cents,photo_path").eq("barbershop_id", shop.id).eq("active", true).order("created_at", { ascending: false }).limit(24),
    supabase.from("shop_page_settings").select("*").eq("barbershop_id", shop.id).maybeSingle(),
    supabase.from("gallery_images").select("id,photo_path,caption").eq("barbershop_id", shop.id).order("created_at", { ascending: false }).limit(12),
  ]);
  return { shop, services: services ?? [], pros: pros ?? [], hours: (hours ?? []) as Hour[], products: products ?? [], cfg: (cfg ?? {}) as Record<string, string | boolean | null>, gallery: gallery ?? [] };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await loadShop((await params).slug);
  return { title: data?.shop.name ?? "Barbearia", description: data ? `Agende seu horário na ${data.shop.name}: serviços, preços e equipe.` : undefined };
}

// Página pública da barbearia (visível para anônimos graças à RLS: só barbearias com acesso liberado).
export default async function ShopPage({ params }: Props) {
  const data = await loadShop((await params).slug);
  if (!data) notFound();
  const { shop, services, pros, hours, products, cfg, gallery } = data;
  const user = await getUser();
  const home = user ? await resolveHome() : null;
  const teamMode = (cfg.team_mode as string) ?? "cards";
  const showGallery = (cfg.show_gallery as boolean) ?? true;
  const socials = (["instagram", "facebook", "tiktok", "youtube", "website", "maps"] as SocialKey[]).flatMap((k) => (typeof cfg[k] === "string" && cfg[k] ? [{ key: k, href: cfg[k] as string }] : []));
  const open = new Map(hours.map((h) => [h.weekday, h]));
  const wa = waLink(shop.phone, `Olá! Vim pela página da ${shop.name}.`);
  const todayDow = new Date(`${spParts(nowISO()).ymd}T12:00:00Z`).getUTCDay();
  const todayHours = open.get(todayDow);
  const book = `/b/${shop.slug}/agendar`;
  const cheapest = services[0]?.price_cents;
  const withPhoto = pros.filter((p) => p.photo_path);
  const withoutPhoto = pros.filter((p) => !p.photo_path);

  const Chip = ({ name, photo }: { name: string; photo: string | null }) => (
    <li className="flex items-center gap-2.5 rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-4">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" loading="lazy" className="size-9 rounded-full object-cover" />
      ) : <span className="font-display flex size-9 items-center justify-center rounded-full bg-night text-lg text-white">{name.slice(0, 1)}</span>}
      <span className="text-sm font-medium">{name}</span>
    </li>
  );

  return (
    <div className="flex-1 pb-24 md:pb-0">
      {/* ---------- abertura */}
      <section className="relative overflow-hidden bg-night text-night-ink">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
          <span className="flex min-w-0 items-center gap-2.5 font-display text-lg text-night-ink"><LogoMark className="h-7" /><span className="truncate">{shop.name}</span></span>
          {home ? (
            <Link href={home} className="inline-flex min-h-11 items-center rounded-lg bg-white px-4 text-sm font-semibold text-night hover:bg-night-ink">Minha conta</Link>
          ) : (
            <nav className="flex items-center gap-2" aria-label="Conta">
              <Link href={`/login?next=${encodeURIComponent(`/b/${shop.slug}`)}`} className="inline-flex min-h-11 items-center rounded-lg border border-night-line px-4 text-sm font-medium hover:bg-night-2">Entrar</Link>
              <Link href="/cadastro" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-white px-4 text-sm font-semibold text-night hover:bg-night-ink"><UserPlus size={16} aria-hidden />Criar conta</Link>
            </nav>
          )}
        </header>
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 pb-14 md:grid-cols-[1.4fr_1fr] md:items-end md:pb-16">
          <div>
            <h1 className="font-display rise mt-8 text-[3.2rem] leading-[0.92] sm:mt-12 sm:text-[5rem] lg:text-[6.25rem]">{shop.name}</h1>
            <div className="mt-6 flex flex-wrap items-center gap-2.5 text-sm">
              {hours.length > 0 ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-night-2 px-3.5 py-1.5">
                  <span className={`size-2 rounded-full ${todayHours ? "bg-success" : "bg-night-muted"}`} aria-hidden />
                  {todayHours ? `Aberto hoje, ${hm(todayHours.start_time)} às ${hm(todayHours.end_time)}` : "Fechado hoje"}
                </span>
              ) : null}
              {services.length > 0 && cheapest != null ? <span className="rounded-full bg-night-2 px-3.5 py-1.5">Serviços a partir de {brl(cheapest)}</span> : null}
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href={book} className="inline-flex min-h-13 items-center gap-2.5 rounded-xl bg-white px-7 py-3.5 text-lg font-semibold text-night transition hover:bg-night-ink active:translate-y-px"><CalendarCheck size={20} aria-hidden />Agendar horário</Link>
              {wa ? <WhatsAppLink href={wa} dark className="min-h-13 rounded-xl px-6 text-lg" /> : null}
            </div>
            {socials.length > 0 ? (
              <ul className="mt-5 flex flex-wrap gap-2" aria-label="Redes sociais">
                {socials.map(({ key, href }) => (
                  <li key={key}>
                    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-night-line px-3.5 text-sm hover:bg-night-2"><SocialIcon kind={key} />{SOCIAL_LABEL[key]}</a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <aside className="hidden md:block" aria-label="Resumo">
            <ul className="space-y-4 rounded-2xl border border-night-line bg-night-2 p-6 text-sm">
              <li className="flex items-center gap-3"><Scissors size={18} className="text-night-muted" aria-hidden /><span><strong className="font-display text-2xl">{services.length}</strong> <span className="text-night-muted">{services.length === 1 ? "serviço" : "serviços"}</span></span></li>
              <li className="flex items-center gap-3"><Users size={18} className="text-night-muted" aria-hidden /><span><strong className="font-display text-2xl">{pros.length}</strong> <span className="text-night-muted">{pros.length === 1 ? "profissional" : "profissionais"}</span></span></li>
              <li className="flex items-center gap-3"><Clock size={18} className="text-night-muted" aria-hidden /><span className="text-night-muted">Agendamento online, sem ligar</span></li>
            </ul>
          </aside>
        </div>
        <span className="pole absolute inset-x-0 bottom-0 h-1.5" aria-hidden />
      </section>

      <main className="mx-auto w-full max-w-6xl space-y-14 px-5 py-12 md:space-y-16 md:py-16">
        {/* ---------- o que o cliente quer primeiro: preços e horários */}
        <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:gap-12">
          <section aria-labelledby="servicos">
            <h2 id="servicos" className="font-display text-4xl leading-none sm:text-5xl">Serviços e preços</h2>
            {services.length === 0 ? (
              <p className="mt-4 text-sm text-muted">Esta barbearia ainda não cadastrou serviços.</p>
            ) : (
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {services.map((sv) => (
                  <li key={sv.id} className="flex flex-col justify-between rounded-2xl border border-line bg-surface p-5">
                    <div>
                      <p className="font-display text-2xl leading-tight">{sv.name}</p>
                      {sv.description ? <p className="mt-1.5 text-sm text-muted">{sv.description}</p> : null}
                    </div>
                    <div className="mt-5 flex items-end justify-between">
                      <span className="inline-flex items-center gap-1.5 text-sm text-muted"><Clock size={15} aria-hidden />{sv.duration_minutes} min</span>
                      <span className="font-display text-3xl leading-none">{brl(sv.price_cents)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {services.length > 0 ? <Link href={book} className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-accent px-6 font-semibold text-accent-ink hover:bg-accent-hover">Agendar horário</Link> : null}
          </section>

          {hours.length > 0 ? (
            <section aria-labelledby="horarios">
              <h2 id="horarios" className="font-display text-4xl leading-none sm:text-5xl">Horários</h2>
              <ul className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface text-sm">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                  const h = open.get(d);
                  const now = d === todayDow;
                  return (
                    <li key={d} className={`flex justify-between gap-4 border-b border-line px-4 py-2.5 last:border-0 ${now ? "bg-night font-medium text-night-ink" : ""}`}>
                      <span>{DAYS[d]}{now ? " · hoje" : ""}</span>
                      <span className={`text-right tabular-nums ${h ? "" : now ? "text-night-muted" : "text-muted"}`}>{h ? `${hm(h.start_time)} às ${hm(h.end_time)}${h.break_start && h.break_end ? ` · pausa ${hm(h.break_start)} às ${hm(h.break_end)}` : ""}` : "Fechado"}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>

        {/* ---------- vitrine (só aparece se o dono cadastrou produtos) */}
        {products.length > 0 ? (
          <section aria-labelledby="vitrine" className="-mx-5 bg-night px-5 py-12 text-night-ink sm:mx-0 sm:rounded-3xl sm:px-10">
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

        {/* ---------- portfólio (opcional) */}
        {showGallery && gallery.length > 0 ? (
          <section aria-labelledby="portfolio">
            <h2 id="portfolio" className="font-display text-4xl leading-none sm:text-5xl">Nossos trabalhos</h2>
            <div className="mt-6">
              <GalleryCarousel images={gallery.map((g) => ({ id: g.id, url: mediaUrl(g.photo_path)!, caption: g.caption }))} />
            </div>
          </section>
        ) : null}

        {/* ---------- equipe: institucional, por último e proporcional ao que a barbearia tem */}
        {pros.length > 0 && teamMode !== "hidden" ? (
          <section aria-labelledby="equipe">
            <h2 id="equipe" className="font-display text-3xl leading-none sm:text-4xl">Quem atende</h2>
            {teamMode === "cards" && withPhoto.length > 0 ? (
              <>
                <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
                  {withPhoto.map((p) => (
                    <li key={p.id}>
                      <div className="aspect-[4/5] overflow-hidden rounded-xl bg-night-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={mediaUrl(p.photo_path)!} alt={p.display_name} loading="lazy" className="size-full object-cover" />
                      </div>
                      <p className="font-display mt-2 text-lg leading-tight">{p.display_name}</p>
                    </li>
                  ))}
                </ul>
                {withoutPhoto.length > 0 ? <ul className="mt-4 flex flex-wrap gap-2.5">{withoutPhoto.map((p) => <Chip key={p.id} name={p.display_name} photo={null} />)}</ul> : null}
              </>
            ) : (
              <ul className="mt-5 flex flex-wrap gap-2.5">{pros.map((p) => <Chip key={p.id} name={p.display_name} photo={mediaUrl(p.photo_path)} />)}</ul>
            )}
          </section>
        ) : null}
      </main>

      <footer className="border-t border-line px-5 py-8 text-center text-sm text-muted">
        <div className="flex flex-col items-center gap-2"><p>{shop.name}</p><p className="flex items-center gap-2">Agendamento por <Logo tone="light" size="sm" /></p></div>
      </footer>

      {/* barra de ação fixa no celular */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-night-line bg-night p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
        <Link href={book} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white font-semibold text-night"><CalendarCheck size={19} aria-hidden />Agendar horário</Link>
      </div>
    </div>
  );
}
