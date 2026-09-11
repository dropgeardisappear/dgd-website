"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Check, Minus, Plus } from "lucide-react";
import type { Product } from "@/lib/shop/types";
import { formatMoney } from "@/lib/shop/format";
import { useCart } from "./CartProvider";
import styles from "./shop.module.css";

const specLabels: Record<string, string> = { dimensions: "Dimensions", material: "Material", finish: "Finish", application_care: "Application & care" };

export default function ProductDetail({ product, featured = false }: { product: Product; featured?: boolean }) {
  const initial = product.variants.nodes.find((variant) => variant.availableForSale) || product.variants.nodes[0];
  const [options, setOptions] = useState<Record<string, string>>(Object.fromEntries(initial?.selectedOptions.map((option) => [option.name, option.value]) || []));
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { change, busy } = useCart();
  const variant = product.variants.nodes.find((item) => item.selectedOptions.every((option) => options[option.name] === option.value));
  const gallery = product.images.nodes.length ? product.images.nodes : product.featuredImage ? [product.featuredImage] : [];
  const activeImage = gallery[imageIndex] || variant?.image || product.featuredImage;
  const purchasable = variant?.availableForSale && !product.requiresSellingPlan;
  const details = product.metafields.filter((field) => field?.value);
  const Heading = featured ? "h2" : "h1";

  async function addToCart() {
    if (!variant || !purchasable) return;
    setError(""); setMessage("");
    try {
      const result = await change("POST", { merchandiseId: variant.id, quantity });
      setMessage(result.warning || "Added to your cart.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not add this item.");
    }
  }

  return (
    <section className={styles.productLayout} aria-label={product.title}>
      <div>
        <div className={styles.productImage}>
          <span className={styles.imageTag}>{product.productType || "DGD GOODS"}</span>
          {activeImage ? <Image unoptimized src={activeImage.url} alt={activeImage.altText || product.title} width={activeImage.width || 1200} height={activeImage.height || 1200} priority className={styles.containedImage} /> : <span className={styles.noImage}>DGD</span>}
        </div>
        {gallery.length > 1 && <div className={styles.thumbnails} aria-label="Product photos">
          {gallery.map((image, index) => <button type="button" key={image.url} aria-label={`View photo ${index + 1}`} aria-pressed={index === imageIndex} className={index === imageIndex ? styles.selectedThumbnail : styles.thumbnail} onClick={() => setImageIndex(index)}><Image unoptimized src={image.url} alt={image.altText || `${product.title}, photo ${index + 1}`} width={96} height={96} /></button>)}
        </div>}
      </div>
      <div className={styles.productInfo}>
        <p className={styles.eyebrow}>DROP GEAR DISAPPEAR / {product.productType || "GOODS"}</p>
        <Heading className={styles.productTitle}>{product.title}</Heading>
        <div className={styles.priceRow}>
          <span className={styles.price}>{formatMoney(variant?.price || product.priceRange.minVariantPrice)}</span>
          {variant?.compareAtPrice && Number(variant.compareAtPrice.amount) > Number(variant.price.amount) && <del>{formatMoney(variant.compareAtPrice)}</del>}
        </div>
        <p className={styles.description}>{product.description}</p>
        {product.options.filter((option) => !(option.name === "Title" && option.values.length === 1 && option.values[0] === "Default Title")).map((option) => <fieldset className={styles.optionGroup} key={option.name} disabled={busy}>
          <legend>{option.name}</legend>
          <div className={styles.optionValues}>{option.values.map((value) => <button type="button" key={value} aria-pressed={options[option.name] === value} onClick={() => {
            const next = { ...options, [option.name]: value }; setOptions(next); setMessage(""); setError("");
            const selectedVariant = product.variants.nodes.find((item) => item.selectedOptions.every((selected) => next[selected.name] === selected.value));
            const index = gallery.findIndex((image) => image.url === selectedVariant?.image?.url);
            setImageIndex(index < 0 ? 0 : index);
          }}>{value}</button>)}</div>
        </fieldset>)}
        <p className={styles.availability}>{product.requiresSellingPlan ? "This item is not available through this shop." : !variant ? "This combination is unavailable." : variant.availableForSale ? "Available" : "Sold out"}</p>
        <div className={styles.purchaseRow}>
          <div className={styles.quantity} role="group" aria-label="Quantity">
            <button type="button" aria-label="Decrease quantity" disabled={quantity <= 1 || busy || !purchasable} onClick={() => setQuantity(quantity - 1)}><Minus size={16} /></button>
            <span aria-live="polite">{quantity}</span>
            <button type="button" aria-label="Increase quantity" disabled={quantity >= 99 || busy || !purchasable} onClick={() => setQuantity(quantity + 1)}><Plus size={16} /></button>
          </div>
          <button className={styles.primaryButton} type="button" disabled={!purchasable || busy} onClick={addToCart}>{busy ? "Updating cart…" : purchasable ? "Add to cart" : "Unavailable"}</button>
        </div>
        <p className={styles.purchaseNote}>Shipping and applicable taxes are calculated at checkout.</p>
        {message && <div className={styles.success} role="status"><Check size={18} aria-hidden="true" /><span>{message} <Link href="/shop/cart">View cart</Link></span></div>}
        {error && <p className={styles.error} role="alert">{error} <Link href="/shop/cart">Review cart</Link></p>}
        {details.length > 0 && <details className={styles.details} open><summary>Specifications & care</summary><dl>{details.map((field) => field && <div key={field.key}><dt>{specLabels[field.key] || field.key}</dt><dd>{field.value}</dd></div>)}</dl></details>}
        {featured && <Link className={styles.textLink} href={`/shop/${product.handle}`}>View product details</Link>}
      </div>
    </section>
  );
}
