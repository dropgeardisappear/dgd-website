"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ShopProductRow } from "@/lib/shop/database-types";
import type { ProductImage } from "@/lib/shop/types";
import { priceInCents } from "@/lib/shop/validation";
import s from "./admin.module.css";

const slug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
type Props = { product: ShopProductRow | null; onClose: () => void; onSaved: () => void };

export default function ProductEditor({ product, onClose, onSaved }: Props) {
  const [form, setForm] = useState({ title: product?.title || "", handle: product?.handle || "", description: product?.description || "", category: product?.category || "Stickers", status: product?.status || "draft", price: product?.price_cents ? (product.price_cents / 100).toFixed(2) : "", stock: String(product?.stock_quantity ?? 0), sku: product?.sku || "", weight: product?.weight_grams ? String(product.weight_grams) : "", dimensions: product?.dimensions || "", material: product?.material || "", finish: product?.finish || "", application_care: product?.application_care || "" });
  const [images, setImages] = useState<ProductImage[]>(product?.images || []);
  const [shipsAsLetter, setShipsAsLetter] = useState(product?.ships_as_letter || false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const field = (name: keyof typeof form, value: string) => setForm(current => ({ ...current, [name]: value }));

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(""); setUploading(true);
    const added: ProductImage[] = [];
    try {
      if (images.length + files.length > 10) throw new Error("Use up to 10 product photos.");
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Please sign in again.");
      for (const file of Array.from(files)) {
        const ext = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as Record<string, string>)[file.type];
        if (!ext || file.size > 5 * 1024 * 1024) throw new Error("Choose JPG, PNG, or WebP photos up to 5 MB each.");
        const path = `${data.user.id}/${crypto.randomUUID()}.${ext}`;
        const result = await supabase.storage.from("shop-product-images").upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
        if (result.error) throw new Error("The photo could not be uploaded. Please try again.");
        const { data: publicImage } = supabase.storage.from("shop-product-images").getPublicUrl(path);
        added.push({ url: publicImage.publicUrl, altText: form.title || "DGD product photo" });
      }
    } catch (error) { setError(error instanceof Error ? error.message : "Photos could not be uploaded."); }
    finally { setImages(current => [...current, ...added]); setUploading(false); }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const price = priceInCents(form.price);
      if (price !== null && (price < 50 || price > 99999999)) throw new Error("Price must be at least $0.50 and below $1,000,000.");
      const stock = Number(form.stock), weight = form.weight ? Number(form.weight) : null;
      if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) throw new Error("Enter a whole stock quantity.");
      if (weight !== null && (!Number.isInteger(weight) || weight < 1 || weight > 100000)) throw new Error("Enter the packed weight in whole grams.");
      if (shipsAsLetter && (!weight || weight > 28)) throw new Error("Stamped-letter items need a packed weight between 1 and 28 grams.");
      if (form.status === "active" && (!price || !weight || !images.length)) throw new Error("Add a price, packed weight, and at least one photo before publishing.");
      const values = { title: form.title.trim(), handle: form.handle.trim() || slug(form.title), description: form.description.trim(), category: form.category.trim() || "Goods", status: form.status, price_cents: price, stock_quantity: stock, sku: form.sku.trim(), weight_grams: weight, dimensions: form.dimensions.trim(), material: form.material.trim(), finish: form.finish.trim(), application_care: form.application_care.trim(), images };
      if (!values.title || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(values.handle)) throw new Error("Enter a title and a URL name using letters, numbers, and hyphens.");
      const productValues = { ...values, ships_as_letter: shipsAsLetter };
      const query = product ? supabase.from("shop_products").update(productValues).eq("id", product.id).eq("updated_at", product.updated_at) : supabase.from("shop_products").insert(productValues);
      const result = await query.select("id").maybeSingle();
      if (result.error?.code === "23505") throw new Error("That URL name is already in use. Choose another.");
      if (result.error?.code === "23514") throw new Error("Check the product details. Stock on hand cannot be lower than reserved stock.");
      if (result.error) throw new Error("The product could not be saved. Check your access and try again.");
      if (!result.data) throw new Error("This product or its stock changed while you were editing. Go back and reopen it before saving.");
      onSaved();
    } catch (error) { setError(error instanceof Error ? error.message : "The product could not be saved."); }
    finally { setBusy(false); }
  }

  return <form onSubmit={save}>
    <div className={s.toolbar}><div><h2>{product ? "Edit product" : "Add product"}</h2><p>Save a draft, or publish when the details are ready.</p></div><button className={s.secondary} type="button" onClick={onClose} disabled={busy || uploading}>Back to products</button></div>
    {error && <p role="alert" className={s.error}>{error}</p>}
    <fieldset disabled={busy || uploading} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <div className={s.formGrid}>
        <div>
          <section className={s.panel}><h3>Product details</h3><div className={s.fields}>
            <label className={s.field}>Product name<input value={form.title} required maxLength={160} onChange={event => field("title", event.target.value)} placeholder="DGD Logo Sticker" /></label>
            <label className={s.field}>Description<textarea value={form.description} maxLength={10000} onChange={event => field("description", event.target.value)} rows={5} placeholder="Tell customers what they’re getting." /></label>
            <div className={s.twoFields}><label className={s.field}>Category<input value={form.category} maxLength={80} onChange={event => field("category", event.target.value)} placeholder="Stickers" /></label><label className={s.field}>URL name<input value={form.handle} maxLength={120} onChange={event => field("handle", event.target.value)} placeholder={slug(form.title) || "dgd-logo-sticker"} /><small>/shop/{form.handle || slug(form.title) || "product-name"}</small></label></div>
          </div></section>
          <section className={s.panel}><h3>Product photos</h3><p className={s.help}>The first photo is the main image. Up to 10 JPG, PNG, or WebP files, 5 MB each.</p>
            <div className={s.imageGrid}>{images.map((image, index) => <div className={s.imageCard} key={image.url}><img src={image.url} alt={image.altText || form.title || "Product photo"} /><div className={s.imageActions}>{index > 0 ? <button type="button" onClick={() => setImages(current => [current[index], ...current.filter((_, i) => i !== index)])}>Make main</button> : <span className={s.help}>Main photo</span>}<button type="button" aria-label={`Remove photo ${index + 1}`} onClick={() => setImages(current => current.filter((_, i) => i !== index))}>Remove</button></div></div>)}</div>
            <input className={s.file} type="file" accept="image/png,image/jpeg,image/webp" multiple aria-label="Upload product photos" onChange={event => { void upload(event.target.files); event.target.value = ""; }} />
          </section>
          <section className={s.panel}><h3>Specifications & care</h3><div className={s.fields}>
            <label className={s.field}>Dimensions<input value={form.dimensions} maxLength={300} onChange={event => field("dimensions", event.target.value)} placeholder="Enter the actual width × height" /></label>
            <div className={s.twoFields}><label className={s.field}>Material<input value={form.material} maxLength={300} onChange={event => field("material", event.target.value)} /></label><label className={s.field}>Finish<input value={form.finish} maxLength={300} onChange={event => field("finish", event.target.value)} /></label></div>
            <label className={s.field}>Application & care<textarea value={form.application_care} maxLength={3000} onChange={event => field("application_care", event.target.value)} rows={3} /><small>Leave unknown details blank. Use manufacturer-confirmed care instructions.</small></label>
          </div></section>
        </div>
        <div>
          <section className={s.panel}><h3>Publishing</h3><label className={s.field}>Product status<select value={form.status} onChange={event => field("status", event.target.value)}><option value="draft">Draft — only you can see it</option><option value="active">Published — visible in the shop</option><option value="archived">Archived — hidden from the shop</option></select><small>Publishing shows the listing. Checkout opens separately in Shop settings.</small></label></section>
          <section className={s.panel}><h3>Price & inventory</h3><div className={s.fields}>
            <label className={s.field}>Price (USD)<input inputMode="decimal" value={form.price} onChange={event => field("price", event.target.value)} placeholder="0.00" required={form.status === "active"} /></label>
            <label className={s.field}>Stock on hand<input type="number" inputMode="numeric" min={product?.reserved_quantity || 0} max={1000000} step={1} required value={form.stock} onChange={event => field("stock", event.target.value)} /><small>{product?.reserved_quantity || 0} reserved in unpaid checkouts. Enter all units you currently have, including reserved units.</small></label>
            <label className={s.field}>SKU (optional)<input value={form.sku} maxLength={80} onChange={event => field("sku", event.target.value)} /></label>
            <label className={s.field}>Packed weight (grams)<input type="number" inputMode="numeric" min={1} max={100000} step={1} value={form.weight} onChange={event => field("weight", event.target.value)} required={form.status === "active"} /><small>Weigh one item with its packaging. Shipping estimates count this weight for every unit.</small></label>
            <label className={s.checkbox}><input type="checkbox" checked={shipsAsLetter} onChange={event => setShipsAsLetter(event.target.checked)} /><span>Fits a regular, flexible paper envelope</span></label><p className={s.help}>Use this only for items that meet USPS letter size, thickness, and flexibility rules. Our stamped-mail option accepts up to 28g per packed item. Other products need a different shipping setup.</p>
          </div></section>
        </div>
      </div>
      <div className={s.actions}><button className={s.primary} type="submit">{busy ? "Saving…" : "Save product"}</button><button className={s.secondary} type="button" onClick={onClose}>Cancel</button></div>
    </fieldset>
    {uploading && <p className={s.notice} role="status">Uploading photos…</p>}
  </form>;
}
