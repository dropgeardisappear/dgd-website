import type { Metadata } from "next";
import ShopManager from "@/components/shop/admin/ShopManager";

export const metadata: Metadata = { title: "Manage shop | DGD", robots: { index: false, follow: false } };
export default async function ShopAdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <ShopManager initialTab={tab === "orders" || tab === "settings" ? tab : "products"} />;
}
