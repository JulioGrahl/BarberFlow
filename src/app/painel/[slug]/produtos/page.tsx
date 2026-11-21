import type { Metadata } from "next";
import { Plus, Trash2 } from "lucide-react";
import { deleteProduct, saveProduct } from "@/app/actions/shop";
import { ActionForm, inputCls, L } from "@/components/master-forms";
import { Drawer } from "@/components/drawer";
import { PhotoInput } from "@/components/photo-input";
import { Empty, PageHead } from "@/components/kit";
import { requireShopAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { mediaUrl } from "@/lib/media";
import { brl } from "@/lib/format";

export const metadata: Metadata = { title: "Vitrine" };

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
  return (
    <>
      <PageHead title="Vitrine" sub="Produtos que a barbearia vende no balcão. Aparecem na sua página pública só para o cliente conhecer; não há compra pelo site. Sem produtos ativos, a seção não aparece."
        actions={
          <Drawer title="Novo produto" trigger={<><Plus size={16} aria-hidden /> Novo produto</>}>
            <ActionForm action={saveProduct} submit="Adicionar produto" className="space-y-4"><Fields slug={slug} /></ActionForm>
          </Drawer>
        } />
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
