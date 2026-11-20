import { requireShopAccess } from "@/lib/auth";
import { ShopNav } from "@/components/shop-nav";

export default async function ShopLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await requireShopAccess(slug);
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <aside className="border-b border-line bg-surface p-3 md:w-60 md:border-b-0 md:border-r md:p-4">
        <p className="truncate px-3 text-sm font-semibold tracking-wide text-accent">{access.barbershop.name}</p>
        <p className="px-3 pb-3 text-xs text-muted md:pb-5">{access.role === "owner" ? "Proprietário" : "Barbeiro"}</p>
        <ShopNav slug={slug} owner={access.role === "owner"} />
      </aside>
      <main className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
