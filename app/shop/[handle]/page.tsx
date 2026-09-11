import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, shopIsConfigured } from "@/lib/shop/catalog";
import ProductDetail from "@/components/shop/ProductDetail";
import styles from "@/components/shop/shop.module.css";

type Props = { params: Promise<{ handle: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!shopIsConfigured()) return { title: "Shop coming soon", robots: { index: false } };
  const { handle } = await params;
  const product = await getProduct(handle);
  if (!product) return { title: "Product not found", robots: { index: false } };
  return { title: product.seo.title || product.title, description: product.seo.description || product.description.slice(0, 160) };
}

export default async function ProductPage({ params }: Props) {
  if (!shopIsConfigured()) return <div className={styles.statusPanel}><h1>The shop is coming soon.</h1><p>Explore the first DGD release.</p><Link href="/shop" className={styles.secondaryButton}>Back to shop</Link></div>;
  const { handle } = await params;
  if (handle.length > 255) notFound();
  const product = await getProduct(handle);
  if (!product) notFound();
  return <>
    <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link href="/shop">Shop</Link><span aria-hidden="true">/</span><span aria-current="page">{product.title}</span></nav>
    <ProductDetail product={product} />
  </>;
}
