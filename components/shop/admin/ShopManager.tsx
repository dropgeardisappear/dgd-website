"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { usd, type ShopProductRow, type ShopOrder, type ShopSettings } from "@/lib/shop/database-types";
import ProductEditor from "./ProductEditor";
import SettingsEditor, { type PaymentSetup } from "./SettingsEditor";
import s from "./admin.module.css";

type Tab = "products" | "orders" | "settings";
const tabs: Tab[] = ["products", "orders", "settings"];

async function adminRequest(path: string, method = "GET") {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Please sign in again.");
  const response = await fetch(path, { method, headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "This request could not be completed.");
  return result;
}

function OrderCard({ order, onSaved }: { order: ShopOrder; onSaved: () => void }) {
  const [editing, setEditing] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [carrier, setCarrier] = useState(order.carrier), [tracking, setTracking] = useState(order.tracking_number);
  const address = order.shipping_address;
  async function ship(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const { error } = await supabase.rpc("shop_mark_shipped", { p_order_id: order.id, p_carrier: carrier, p_tracking: tracking });
      if (error) throw new Error(error.message);
      setEditing(false); onSaved();
    } catch (error) { setError(error instanceof Error ? error.message : "Shipping details could not be saved."); }
    finally { setBusy(false); }
  }
  return <article className={s.panel}>
    <div className={s.orderHeader}><div><h3>Order #{order.order_number}</h3><div className={s.meta}><span className={s.badge} data-state={order.status}>{order.status}</span>{!order.livemode && <span className={s.badge}>Test · do not ship</span>}{order.refunded_cents > 0 && <span className={s.badge}>{usd(order.refunded_cents)} refunded</span>}<span>{new Date(order.created_at).toLocaleString()}</span></div></div><strong className={s.orderTotal}>{usd(order.total_cents ?? order.subtotal_cents + order.shipping_cents)}{order.total_cents === null && <span className={s.help}> before tax</span>}</strong></div>
    {error && <p className={s.error} role="alert">{error}</p>}
    <div className={s.orderDetails}>
      <div><h4>Items</h4><ul>{order.shop_order_items.map(item => <li key={item.id}><strong>{item.quantity} × {item.title}</strong><br /><span className={s.help}>{usd(item.unit_price_cents)} each{item.sku && ` · ${item.sku}`}</span></li>)}</ul><p className={s.help}>Shipping {usd(order.shipping_cents)} · Tax {usd(order.tax_cents)}</p></div>
      <div><h4>Ship to</h4>{order.customer_name || address ? <><p>{order.customer_name}</p>{address && <><p>{address.line1}</p>{address.line2 && <p>{address.line2}</p>}<p>{[address.city, address.state, address.postal_code].filter(Boolean).join(" ")}</p><p>{address.country}</p></>}{order.customer_email && <p><a href={`mailto:${order.customer_email}`}>{order.customer_email}</a></p>}</> : <p className={s.help}>Customer details appear after payment is confirmed.</p>}</div>
    </div>
    <div className={s.fulfillment}>
      {order.fulfillment_status === "shipped" ? <p>Shipped with {order.carrier}{order.tracking_number && <> · Tracking: {order.tracking_number}</>}</p> : order.status === "paid" && order.refunded_cents === 0 ? editing ? <form onSubmit={ship}><div className={s.twoFields}><label className={s.field}>Carrier / shipping method<input value={carrier} required maxLength={100} onChange={event => setCarrier(event.target.value)} placeholder="USPS, stamped mail, UPS…" /></label><label className={s.field}>Tracking number (if available)<input value={tracking} maxLength={200} onChange={event => setTracking(event.target.value)} /></label></div><div className={s.actions}><button className={s.primary} disabled={busy} type="submit">{busy ? "Saving…" : "Mark shipped"}</button><button className={s.secondary} disabled={busy} type="button" onClick={() => setEditing(false)}>Cancel</button></div></form> : <button className={s.secondary} onClick={() => setEditing(true)}>Mark as shipped</button> : <p className={s.help}>{order.status === "pending" ? "Waiting for payment. Stock is released after Stripe confirms checkout has expired." : "No fulfillment action needed."}</p>}
      {order.stripe_payment_intent && <p className={s.help}><a target="_blank" rel="noopener noreferrer" href={`https://dashboard.stripe.com/${order.livemode ? "" : "test/"}payments/${order.stripe_payment_intent}`}>View payment or refund in Stripe</a></p>}
    </div>
  </article>;
}

export default function ShopManager({ initialTab }: { initialTab: Tab }) {
  const [access, setAccess] = useState<"checking" | "signed-out" | "denied" | "ready">("checking");
  const [tab, setTab] = useState<Tab>(initialTab);
  const [products, setProducts] = useState<ShopProductRow[]>([]), [orders, setOrders] = useState<ShopOrder[]>([]);
  const [settings, setSettings] = useState<ShopSettings | null>(null), [payment, setPayment] = useState<PaymentSetup | null>(null);
  const [editor, setEditor] = useState<ShopProductRow | "new" | null>(null);
  const [page, setPage] = useState(0), [more, setMore] = useState(false), [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true), [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!active) return;
        if (error || !data.user) { setAccess("signed-out"); return; }
        const membership = await supabase.rpc("shop_is_admin");
        if (!active) return;
        if (membership.error) throw new Error("Shop access could not be checked. Please refresh and try again.");
        setAccess(membership.data === true ? "ready" : "denied");
      } catch (error) { if (active) { setError(error instanceof Error ? error.message : "Access could not be checked."); setAccess("denied"); } }
    };
    void check();
    const { data: listener } = supabase.auth.onAuthStateChange(event => { if (event === "SIGNED_OUT") { setAccess("signed-out"); setProducts([]); setOrders([]); setSettings(null); } });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (access !== "ready") return;
    let active = true;
    const load = async () => {
      setLoading(true); setError("");
      try {
        if (tab === "products") {
          const result = await supabase.from("shop_products").select("*").order("created_at", { ascending: false }).order("id").range(page * 20, page * 20 + 20);
          if (result.error) throw new Error("Products could not be loaded.");
          if (active) { setProducts((result.data as ShopProductRow[]).slice(0, 20)); setMore(result.data.length > 20); }
        } else if (tab === "orders") {
          const result = await supabase.from("shop_orders").select("*,shop_order_items(*)").order("created_at", { ascending: false }).order("id").range(page * 20, page * 20 + 20);
          if (result.error) throw new Error("Orders could not be loaded.");
          if (active) { setOrders((result.data as ShopOrder[]).slice(0, 20)); setMore(result.data.length > 20); }
        } else {
          const [result, connection] = await Promise.all([supabase.from("shop_settings").select("*").eq("id", 1).single(), adminRequest("/api/admin/shop/status").catch(() => null)]);
          if (result.error) throw new Error("Shop settings could not be loaded.");
          if (active) { setSettings(result.data as ShopSettings); setPayment(connection); }
        }
      } catch (error) { if (active) setError(error instanceof Error ? error.message : "Please try again."); }
      finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [access, tab, page, reload]);

  const changeTab = (next: Tab) => { setTab(next); setPage(0); setEditor(null); setMessage(""); setError(""); };
  const saved = (text: string) => { setEditor(null); setMessage(text); setReload(current => current + 1); };
  async function sync() {
    setSyncing(true); setError(""); setMessage("");
    try { const result = await adminRequest("/api/admin/shop/sync", "POST"); setMessage(`Checked ${result.synced} orders.${result.retry ? ` ${result.retry} still need another attempt.` : ""}`); setReload(current => current + 1); }
    catch (error) { setError(error instanceof Error ? error.message : "Orders could not be checked."); }
    finally { setSyncing(false); }
  }

  return <main className={s.shell}><div className={s.wrap}>
    <header className={s.top}><div><p className={s.eyebrow}>DROP GEAR DISAPPEAR</p><h1 className={s.title}>Manage shop.</h1></div><nav className={s.topLinks} aria-label="Admin navigation"><Link href="/shop">View shop ↗</Link><Link href="/admin">Build approvals</Link><Link href="/">Home</Link></nav></header>
    {access === "checking" ? <p className={s.notice} role="status" style={{ marginTop: 28 }}>Checking shop access…</p> : access !== "ready" ? <section className={s.empty} style={{ marginTop: 28 }}><h2>{access === "signed-out" ? "Sign in to manage your shop." : "Shop owner access required."}</h2><p>{error || (access === "signed-out" ? "Use the DGD account that owns the shop." : "This account does not have access to products or customer orders.")}</p><Link className={s.primary} href="/login">Sign in</Link><p className={s.help}>After signing in, return to this page.</p></section> : <>
      <div className={s.tabs} role="tablist" aria-label="Shop sections" onKeyDown={event => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); const index = (tabs.indexOf(tab) + (event.key === "ArrowRight" ? 1 : 2)) % 3; changeTab(tabs[index]); (event.currentTarget.children[index] as HTMLElement).focus(); } }}>
        {tabs.map(item => <button id={`tab-${item}`} key={item} role="tab" tabIndex={item === tab ? 0 : -1} aria-selected={item === tab} aria-controls="shop-admin-panel" onClick={() => changeTab(item)}>{item === "products" ? "Products" : item === "orders" ? "Orders" : "Settings"}</button>)}
      </div>
      {error && <p className={s.error} role="alert">{error}</p>}{message && <p className={s.message} role="status">{message}</p>}
      <div role="tabpanel" id="shop-admin-panel" aria-labelledby={`tab-${tab}`}>
        {editor ? <ProductEditor product={editor === "new" ? null : editor} onClose={() => setEditor(null)} onSaved={() => saved("Product saved.")} /> : loading ? <p role="status" className={s.notice}>Loading {tab}…</p> : tab === "products" ? <>
          <div className={s.toolbar}><div><h2>Your products</h2><p>Manage listings, photos, prices, and stock.</p></div><button className={s.primary} onClick={() => { setEditor("new"); setMessage(""); }}>+ Add product</button></div>
          {!products.length ? <section className={s.empty}><h3>Your first product starts here.</h3><p>Add its photos and details, then save a draft or publish it.</p><button className={s.primary} onClick={() => setEditor("new")}>Add product</button></section> : products.map(product => <article className={s.productRow} key={product.id}>
            {product.images[0] ? <img src={product.images[0].url} alt={product.images[0].altText || product.title} /> : <span className={s.productPlaceholder}>DGD</span>}
            <div><h3>{product.title}</h3><div className={s.meta}><span className={s.badge} data-state={product.status}>{product.status === "active" ? "Published" : product.status}</span><span>{product.price_cents === null ? "Price needed" : usd(product.price_cents)}</span><span>{product.stock_quantity - product.reserved_quantity} available{product.reserved_quantity ? ` · ${product.reserved_quantity} reserved` : ""}</span>{product.sku && <span>{product.sku}</span>}</div></div>
            <button className={s.secondary} onClick={() => { setEditor(product); setMessage(""); }}>Edit product</button>
          </article>)}
        </> : tab === "orders" ? <>
          <div className={s.toolbar}><div><h2>Customer orders</h2><p>Payment status, items, and shipping details in one place.</p></div><button className={s.secondary} disabled={syncing} onClick={sync}>{syncing ? "Checking payments…" : "Sync payments"}</button></div>
          {!orders.length ? <section className={s.empty}><h3>No orders yet.</h3><p>Orders will appear here when a customer opens checkout. Wait for “Paid” before shipping.</p></section> : orders.map(order => <OrderCard key={order.id} order={order} onSaved={() => saved("Shipping details saved.")} />)}
        </> : settings ? <SettingsEditor key={settings.updated_at} settings={settings} payment={payment} onSaved={() => saved("Shop settings saved.")} /> : null}
        {!editor && !loading && tab !== "settings" && (page > 0 || more) && <nav className={s.pagination} aria-label={`${tab} pages`}><button className={s.secondary} disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page + 1}</span><button className={s.secondary} disabled={!more} onClick={() => setPage(page + 1)}>Next</button></nav>}
        {!editor && error && <button className={s.secondary} onClick={() => setReload(current => current + 1)}>Try again</button>}
      </div>
    </>}
  </div></main>;
}
