import { requireShopAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { nowISO } from "@/lib/format";
import { ShopNav } from "@/components/shop-nav";

export default async function ShopLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await requireShopAccess(slug);
  const supabase = await createClient();
  // atendimentos cujo horário já passou e ainda não foram concluídos nem marcados como falta
  const { count } = await supabase.from("appointments").select("id", { count: "exact", head: true })
    .eq("barbershop_id", access.barbershop.id).eq("status", "scheduled").lt("ends_at", nowISO());
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <ShopNav slug={slug} owner={access.role === "owner"} name={access.barbershop.name} pending={count ?? 0} />
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-9">{children}</main>
    </div>
  );
}
