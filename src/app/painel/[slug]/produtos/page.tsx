import type { Metadata } from "next";
import { Plus, Trash2 } from "lucide-react";
import { addGalleryImage, deleteGalleryImage, deleteProduct, savePageSettings, saveProduct } from "@/app/actions/shop";
import { SOCIAL_FIELDS } from "@/lib/social";
import { ActionForm, inputCls, L } from "@/components/master-forms";
import { Drawer } from "@/components/drawer";
import { PhotoInput } from "@/components/photo-input";
import { Empty, PageHead, Panel } from "@/components/kit";
import { requireShopAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { mediaUrl } from "@/lib/media";
import { brl } from "@/lib/format";

export const metadata: Metadata = { title: "Vitrine e página" };

type Product = { id: string; name: string; description: string | null; price_cents: number | null; photo_path: string | null; active: boolean };

function Fields({ slug, p }: { slug: string; p?: Product }) {
  return (
    <>
      <input type="hidden" name="slug" value={slug} />
      {p ? <input type="hidden" name="id" value={p.id} /> : null}
      <PhotoInput label="Foto do produto" currentUrl={mediaUrl(p?.photo_path)} />
      <L label="Nome"><input name="name" defaultValue={p?.name} required maxLength={80} className={inputCls} placeholder="Ex.: Pomada modeladora" /></L>
      <L label="Descrição (opcional)"><textarea name="description" defaultValue={p?.description ?? ""} maxLength={240} rows={3} className={inputCls} placeholder="Ex.: Fixação forte, acabamento fosco." /></L>
      <L label="Preço (opcional)"><input name="price" defaultValue={p?.price_cents != null ? (p.price_cents / 100).toFixed(2).replace(".", ",") : ""} inputMode="decimal" placeholder="39,90" className={inputCls} /></L>
      {p ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={p.active} /> Aparece na página pública</label> : null}
    </>
  );
}

export default async function ProductsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { barbershop } = await requireShopAccess(slug, ["owner"]);
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("id, name, description, price_cents, photo_path, active").eq("barbershop_id", barbershop.id).order("created_at", { ascending: false });
  const list = (data ?? []) as Product[];
  const [{ data: cfgRow }, { data: galData }] = await Promise.all([
    supabase.from("shop_page_settings").select("*").eq("barbershop_id", barbershop.id).maybeSingle(),
    supabase.from("gallery_images").select("id, photo_path, caption").eq("barbershop_id", barbershop.id).order("created_at", { ascending: false }),
  ]);
  const cfg = (cfgRow ?? {}) as Record<string, string | boolean | null>;
  const teamMode = (cfg.team_mode as string) ?? "cards";
  const gallery = galData ?? [];
  const modes = [
    ["cards", "Com fotos", "Cartões com a foto de cada profissional (quem não tem foto aparece só como nome)."],
    ["compact", "Minimalista", "Uma linha discreta com o nome de cada profissional."],
    ["hidden", "Ocultar", "Não mostra a seção de equipe na página."],
  ] as const;
  return (
    <>
      <PageHead title="Vitrine e página" sub="Personalize o que o cliente vê na página pública da barbearia: equipe, portfólio, redes sociais e produtos do balcão." />

      <Panel title="Aparência da página" sub="Serviços, preços e horários sempre aparecem primeiro." className="mb-4 max-w-3xl">
        <ActionForm action={savePageSettings} submit="Salvar aparência" className="space-y-6">
          <input type="hidden" name="slug" value={slug} />
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Seção &quot;Quem atende&quot;</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {modes.map(([v, t, d]) => (
                <label key={v} className="flex cursor-pointer gap-3 rounded-xl border border-line-strong p-3 has-[:checked]:border-accent has-[:checked]:bg-surface-2 has-[:checked]:ring-1 has-[:checked]:ring-accent">
                  <input type="radio" name="team_mode" value={v} defaultChecked={teamMode === v} className="mt-1" />
                  <span><span className="block text-sm font-semibold">{t}</span><span className="block text-sm text-muted">{d}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line-strong p-3">
            <input type="checkbox" name="show_gallery" defaultChecked={(cfg.show_gallery as boolean) ?? true} className="mt-1" />
            <span><span className="block text-sm font-semibold">Mostrar o portfólio de trabalhos (carrossel)</span><span className="block text-sm text-muted">Só aparece se houver fotos cadastradas abaixo.</span></span>
          </label>
          <fieldset>
            <legend className="mb-1 text-sm font-medium">Redes sociais e links</legend>
            <p className="mb-3 text-sm text-muted">Cada link preenchido vira um botão na página. Deixe em branco para não mostrar.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {SOCIAL_FIELDS.map((f) => (
                <L key={f.key} label={f.label}><input name={f.key} defaultValue={(cfg[f.key] as string) ?? ""} placeholder={f.placeholder} className={inputCls} /></L>
              ))}
            </div>
          </fieldset>
        </ActionForm>
      </Panel>

      <Panel title="Portfólio de trabalhos" sub={`${gallery.length} de 12 fotos. Aparecem em um carrossel na página.`} className="mb-4 max-w-3xl"
        aside={gallery.length < 12 ? (
          <Drawer title="Nova foto do portfólio" trigger={<><Plus size={16} aria-hidden /> Adicionar foto</>}>
            <ActionForm action={addGalleryImage} submit="Adicionar ao portfólio" className="space-y-4">
              <input type="hidden" name="slug" value={slug} />
              <PhotoInput label="Foto do corte" />
              <L label="Legenda (opcional)"><input name="caption" maxLength={100} className={inputCls} placeholder="Ex.: Degradê com barba alinhada" /></L>
            </ActionForm>
          </Drawer>
        ) : undefined}>
        {gallery.length === 0 ? <Empty>Nenhuma foto ainda. Mostre cortes e barbas feitos na casa.</Empty> : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {gallery.map((g) => (
              <li key={g.id} className="overflow-hidden rounded-xl border border-line bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(g.photo_path)!} alt={g.caption ?? ""} loading="lazy" className="aspect-[4/5] w-full object-cover" />
                <form action={deleteGalleryImage} className="flex items-center justify-between gap-2 px-2.5 py-2">
                  <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={g.id} />
                  <span className="min-w-0 truncate text-sm text-muted">{g.caption ?? "Sem legenda"}</span>
                  <button aria-label="Remover foto" className="flex size-9 shrink-0 items-center justify-center rounded-lg text-danger hover:bg-danger-bg"><Trash2 size={16} aria-hidden /></button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="mb-4 mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl leading-tight">Produtos do balcão</h2>
          <p className="max-w-2xl text-sm text-muted">Aparecem na página só para o cliente conhecer; não há compra pelo site. Sem produtos ativos, a seção não aparece.</p>
        </div>
        <Drawer title="Novo produto" trigger={<><Plus size={16} aria-hidden /> Novo produto</>}>
          <ActionForm action={saveProduct} submit="Adicionar produto" className="space-y-4"><Fields slug={slug} /></ActionForm>
        </Drawer>
      </div>
      {list.length === 0 ? <Empty>Nenhum produto ainda. Cadastre pomadas, óleos de barba ou o que você vende no balcão.</Empty> : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <li key={p.id}>
              <Drawer title={p.name} triggerClassName={`group w-full overflow-hidden rounded-xl border border-line bg-surface text-left transition hover:border-line-strong ${p.active ? "" : "opacity-60"}`}
                trigger={
                  <span className="block">
                    <span className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-surface-2">
                      {p.photo_path ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mediaUrl(p.photo_path)!} alt="" loading="lazy" className="size-full object-cover" />
                      ) : <span className="font-display text-5xl text-line-strong">{p.name.slice(0, 1)}</span>}
                    </span>
                    <span className="block p-4">
                      <span className="font-display block truncate text-lg">{p.name}</span>
                      <span className="mt-0.5 block text-sm text-muted">{p.price_cents != null ? brl(p.price_cents) : "Sem preço"}{p.active ? "" : " · oculto"}</span>
                    </span>
                  </span>
                }>
                <div className="space-y-6">
                  <ActionForm action={saveProduct} submit="Salvar alterações" className="space-y-4"><Fields slug={slug} p={p} /></ActionForm>
                  <form action={deleteProduct} className="border-t border-line pt-4">
                    <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={p.id} />
                    <button className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-danger hover:bg-danger-bg"><Trash2 size={16} aria-hidden />Excluir produto</button>
                  </form>
                </div>
              </Drawer>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
