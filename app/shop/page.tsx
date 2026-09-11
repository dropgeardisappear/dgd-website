import Image from "next/image";
import Link from "next/link";
import ProductDetail from "@/components/shop/ProductDetail";
import StickerPreview from "@/components/shop/StickerPreview";
import { getProduct, getProducts, shopIsConfigured } from "@/lib/shop/shopify";
import { formatMoney } from "@/lib/shop/format";
import styles from "@/components/shop/shop.module.css";

export const dynamic = "force-dynamic";

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ after?: string | string[] }> }) {
  const { after } = await searchParams;
  const cursor = typeof after === "string" && after.length <= 1024 ? after : undefined;
  const configured = shopIsConfigured();
  const products = configured ? await getProducts(cursor) : null;
  const singleProduct = products?.nodes.length === 1 && !products.pageInfo.hasNextPage && !cursor ? await getProduct(products.nodes[0].handle) : null;
  return <>
    <div className={styles.pageHeading}>
      <div><p className={styles.eyebrow}>DROP GEAR DISAPPEAR</p><h1 className={styles.pageTitle}>The shop.</h1></div>
      <span className={styles.pageCount}>{!configured ? "First release · Stickers" : "DGD goods"}</span>
    </div>
    {!configured ? <StickerPreview /> : singleProduct ? <ProductDetail product={singleProduct} featured /> : products?.nodes.length ? <>
      <div className={styles.grid}>
        {products.nodes.map((product) => <article key={product.id} className={styles.card}>
          <Link href={`/shop/${product.handle}`}>
            <div className={styles.cardImage}>{product.featuredImage ? <Image unoptimized src={product.featuredImage.url} alt={product.featuredImage.altText || product.title} width={600} height={600} /> : <span className={styles.noImage}>DGD</span>}</div>
            <div className={styles.cardTop}><h2>{product.title}</h2><span className={styles.cardPrice}>{product.priceRange.minVariantPrice.amount !== product.priceRange.maxVariantPrice.amount ? "From " : ""}{formatMoney(product.priceRange.minVariantPrice)}</span></div>
            <p>{!product.availableForSale ? "Sold out" : product.productType || "View product"}</p>
          </Link>
        </article>)}
      </div>
      <nav className={styles.pagination} aria-label="Shop pages">
        {cursor && <Link href="/shop" className={styles.textLink}>Back to first page</Link>}
        {products.pageInfo.hasNextPage && products.pageInfo.endCursor && <Link className={styles.secondaryButton} href={`/shop?after=${encodeURIComponent(products.pageInfo.endCursor)}`}>More products</Link>}
      </nav>
    </> : <div className={styles.statusPanel}><h2>{cursor ? "No more products." : "New goods are on the way."}</h2><p>{cursor ? "Head back to the shop to see the full collection." : "Check back for the next DGD release."}</p><Link href={cursor ? "/shop" : "/"} className={styles.secondaryButton}>{cursor ? "Back to shop" : "Browse builds"}</Link></div>}
  </>;
}
