"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, LockKeyhole, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { formatMoney } from "@/lib/shop/format";
import { useCart } from "./CartProvider";
import styles from "./shop.module.css";

export default function CartPage() {
  const { cart, enabled, busy, loading, error: loadError, change, refresh } = useCart();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  useEffect(() => { void refresh(); }, [refresh]);
  // Back/forward cache can restore the page with its pre-navigation state.
  useEffect(() => {
    const reset = () => setCheckingOut(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  async function update(lineId: string, quantity?: number) {
    setError(""); setNotice("");
    try {
      const result = await change(quantity === undefined ? "DELETE" : "PATCH", { lineId, ...(quantity === undefined ? {} : { quantity }) });
      setNotice(result.warning || (quantity === undefined ? "Item removed." : "Cart updated."));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Your cart could not be updated.");
      await refresh();
    }
  }

  async function checkout() {
    setCheckingOut(true); setError("");
    try {
      const response = await fetch("/api/shop/checkout", { method: "POST" });
      const result = await response.json();
      if (!response.ok || !result.checkoutUrl) throw new Error(result.error || "Checkout could not be opened.");
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Checkout could not be opened.");
      setCheckingOut(false);
      await refresh();
    }
  }

  if (loading) return <p className={styles.statusPanel} role="status">Loading your cart…</p>;
  if (loadError) return <div className={styles.statusPanel}><h2>Let’s get your cart back.</h2><p role="alert">{loadError}</p><button type="button" onClick={refresh} className={styles.secondaryButton}>Try again</button></div>;
  if (cart?.confirmationUrl) return <div className={styles.emptyCart}><h2>Your order is paid.</h2><p>Open your order confirmation before starting a new cart.</p><Link href={cart.confirmationUrl} className={styles.primaryButton}>View order confirmation <ArrowRight size={18} /></Link></div>;
  if (!cart?.lines.length) return <div className={styles.emptyCart}><ShoppingBag size={42} aria-hidden="true" /><h2>Your cart is empty.</h2><p>{enabled ? "Find something for your build, toolbox, or everyday rotation." : "DGD goods are coming soon."}</p><Link href="/shop" className={styles.primaryButton}>Explore the shop <ArrowRight size={18} /></Link></div>;

  const locked = busy || checkingOut;
  return <>
    <div aria-live="polite" className={styles.cartMessages}>{notice && <p>{notice}</p>}</div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.cartLayout}>
      <div className={styles.cartLines} aria-busy={busy}>
        {cart.lines.map((line) => <article className={styles.cartLine} key={line.id}>
          <Link href={`/shop/${line.merchandise.product.handle}`} className={styles.cartImage} aria-label={`View ${line.merchandise.product.title}`}>
            {line.merchandise.image ? <Image unoptimized src={line.merchandise.image.url} alt={line.merchandise.image.altText || line.merchandise.product.title} width={180} height={180} /> : <span>DGD</span>}
          </Link>
          <div className={styles.cartLineBody}>
            <div className={styles.cartLineTop}><h2><Link href={`/shop/${line.merchandise.product.handle}`}>{line.merchandise.product.title}</Link></h2><strong>{formatMoney(line.cost.totalAmount)}</strong></div>
            {line.merchandise.title !== "Default Title" && <p>{line.merchandise.title}</p>}
            {!line.merchandise.availableForSale && <p className={styles.error}>This quantity is unavailable. Reduce it or remove the item.</p>}
            <div className={styles.cartLineActions}>
              <div className={styles.quantity} role="group" aria-label={`Quantity for ${line.merchandise.product.title}`}>
                <button type="button" aria-label={`Decrease ${line.merchandise.product.title} quantity`} disabled={locked || line.quantity <= 1} onClick={() => update(line.id, line.quantity - 1)}><Minus size={16} /></button>
                <span>{line.quantity}</span>
                <button type="button" aria-label={`Increase ${line.merchandise.product.title} quantity`} disabled={locked || line.quantity >= 99} onClick={() => update(line.id, line.quantity + 1)}><Plus size={16} /></button>
              </div>
              <button type="button" className={styles.removeButton} disabled={locked} onClick={() => update(line.id)} aria-label={`Remove ${line.merchandise.product.title}`}><Trash2 size={16} aria-hidden="true" /> Remove</button>
            </div>
          </div>
        </article>)}
        <Link href="/shop" className={styles.textLink}>Continue shopping</Link>
      </div>
      <aside className={styles.orderSummary} aria-labelledby="order-summary-title">
        <h2 id="order-summary-title">Order summary</h2>
        <div className={styles.summaryRow}><span>Subtotal · {cart.totalQuantity} {cart.totalQuantity === 1 ? "item" : "items"}</span><strong>{formatMoney(cart.cost.subtotalAmount)}</strong></div>
        <p className={styles.purchaseNote}>Shipping and applicable taxes are shown at checkout. Your final total is confirmed before payment.</p>
        {!enabled && <p className={styles.purchaseNote}>Checkout is not open yet. Your cart is saved.</p>}
        <button type="button" className={styles.primaryButton} disabled={locked || !enabled || cart.lines.some((line) => !line.merchandise.availableForSale)} onClick={checkout}>{checkingOut ? "Opening checkout…" : "Checkout"}<ArrowRight size={18} aria-hidden="true" /></button>
        <p className={styles.secureNote}><LockKeyhole size={14} aria-hidden="true" /> Secure checkout. No DGD account required.</p>
      </aside>
    </div>
  </>;
}
