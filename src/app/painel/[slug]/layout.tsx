import { requireShopAccess } from "@/lib/auth";
import { ShopNav } from "@/components/shop-nav";

export default async function ShopLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await requireShopAccess(slug);
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <ShopNav slug={slug} owner={access.role === "owner"} name={access.barbershop.name} />
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-9">{children}</main>
    </div>
  );
}
