"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { usd, type ShopSettings } from "@/lib/shop/database-types";
import { priceInCents } from "@/lib/shop/validation";
import s from "./admin.module.css";

export type PaymentSetup = { ready: boolean; database: boolean; stripe: boolean; webhook: boolean; testMode: boolean; email: boolean };
export default function SettingsEditor({ settings, payment, onSaved }: { settings: ShopSettings; payment: PaymentSetup | null; onSaved: () => void }) {
  const [form, setForm] = useState({ ...settings, letterRate: (settings.letter_rate_cents / 100).toFixed(2), shipping: settings.shipping_flat_cents === null ? "" : (settings.shipping_flat_cents / 100).toFixed(2), freeShipping: settings.free_shipping_over_cents === null ? "" : (settings.free_shipping_over_cents / 100).toFixed(2), countries: settings.shipping_countries.join(", ") });
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const shipping = priceInCents(form.shipping), free = priceInCents(form.freeShipping);
      const letterRate = priceInCents(form.letterRate);
      const countries = [...new Set(form.countries.toUpperCase().split(",").map(country => country.trim()).filter(Boolean))];
      if (shipping !== null && shipping > 100000) throw new Error("Shipping must be $1,000 or less per order.");
      if (letterRate === null || letterRate < 50 || letterRate > 100000) throw new Error("Enter a letter shipping charge between $0.50 and $1,000.");
      if (!Number.isInteger(form.letter_max_items) || form.letter_max_items < 1 || form.letter_max_items > 3) throw new Error("Choose 1, 2, or 3 items per envelope.");
      if (!countries.length || countries.length > 30 || countries.some(country => !/^[A-Z]{2}$/.test(country))) throw new Error("Use two-letter country codes separated by commas, such as US, CA.");
      if (form.shipping_mode === "stamped_letters" && countries.join(",") !== "US") throw new Error("Stamped-letter shipping is for U.S. orders only.");
      if (form.store_open && (!payment?.ready || (form.shipping_mode === "flat" && shipping === null) || form.tax_mode === "unconfigured" || !form.shipping_policy.trim() || !form.refund_policy.trim() || !form.support_email.trim())) throw new Error("Finish payment, shipping, tax, contact, and policy settings before opening checkout.");
      const result = await supabase.from("shop_settings").update({ store_open: form.store_open, support_email: form.support_email.trim(), shipping_flat_cents: shipping, shipping_mode: form.shipping_mode, letter_rate_cents: letterRate, letter_max_items: form.letter_max_items, free_shipping_over_cents: free, shipping_countries: countries, tax_mode: form.tax_mode, shipping_policy: form.shipping_policy.trim(), refund_policy: form.refund_policy.trim() }).eq("id", 1).eq("updated_at", settings.updated_at).select("id").maybeSingle();
      if (result.error) throw new Error("Settings could not be saved. Check the fields and try again.");
      if (!result.data) throw new Error("Settings changed in another tab. Reload before saving.");
      onSaved();
    } catch (error) { setError(error instanceof Error ? error.message : "Settings could not be saved."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={save}>
    <div className={s.toolbar}><div><h2>Shop settings</h2><p>Set shipping, customer policies, and when checkout opens.</p></div></div>
    {error && <p className={s.error} role="alert">{error}</p>}
    <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <div className={s.formGrid}>
        <div>
          <section className={s.panel}><h3>Shipping & taxes</h3><div className={s.fields}>
            <label className={s.field}>Shipping method<select value={form.shipping_mode} onChange={event => setForm({ ...form, shipping_mode: event.target.value as ShopSettings["shipping_mode"], ...(event.target.value === "stamped_letters" ? { countries: "US" } : {}) })}><option value="stamped_letters">U.S. stamped letters — no tracking</option><option value="flat">Flat rate per order</option></select></label>
            {form.shipping_mode === "stamped_letters" ? <><div className={s.twoFields}><label className={s.field}>Charge per envelope (USD)<input inputMode="decimal" value={form.letterRate} onChange={event => setForm({ ...form, letterRate: event.target.value })} required /></label><label className={s.field}>Maximum items per envelope<select value={form.letter_max_items} onChange={event => setForm({ ...form, letter_max_items: Number(event.target.value) })}><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></select></label></div><p className={s.help}>We split orders into envelopes with no more than {form.letter_max_items} items or 28g of estimated packed weight each. Different products use separate envelopes. Check a sample envelope for thickness and flexibility before opening checkout.</p><p className={s.help}>At an 8g packed weight, your saved rate of {usd(settings.letter_rate_cents)} covers up to {Math.min(settings.letter_max_items, 3)} stickers per envelope. Stamped mail has no package tracking.</p></> : <label className={s.field}>Flat shipping per order (USD)<input inputMode="decimal" value={form.shipping} onChange={event => setForm({ ...form, shipping: event.target.value })} placeholder="Enter your shipping charge" /><small>Enter 0.00 only if you offer free shipping. This does not fetch carrier rates.</small></label>}
            <label className={s.field}>Free shipping on orders at or above (USD)<input inputMode="decimal" value={form.freeShipping} onChange={event => setForm({ ...form, freeShipping: event.target.value })} placeholder="Optional" /><small>Leave blank to charge shipping on every order.</small></label>
            <label className={s.field}>Ship to countries<input value={form.countries} disabled={form.shipping_mode === "stamped_letters"} onChange={event => setForm({ ...form, countries: event.target.value })} maxLength={120} /><small>{form.shipping_mode === "stamped_letters" ? "This letter-shipping option is limited to the United States." : "Two-letter codes, such as US or US, CA. Confirm these are destinations you can ship to."}</small></label>
            <label className={s.field}>Tax calculation<select value={form.tax_mode} onChange={event => setForm({ ...form, tax_mode: event.target.value as ShopSettings["tax_mode"] })}><option value="unconfigured">Choose your tax setup</option><option value="stripe_tax">Calculate with Stripe Tax — paid feature</option><option value="no_tax">Do not add tax</option></select><small>Choose based on your business’s tax setup. Stripe Tax needs to be configured in your Stripe account.</small></label>
          </div></section>
          <section className={s.panel}><h3>Customer information</h3><div className={s.fields}>
            <label className={s.field}>Customer support email<input type="email" maxLength={254} value={form.support_email} onChange={event => setForm({ ...form, support_email: event.target.value })} placeholder="Your business contact email" /><small>Shown in the shop footer. New-order alerts are sent here when email alerts are connected.</small></label>
            <label className={s.field}>Shipping policy<textarea rows={6} maxLength={10000} value={form.shipping_policy} onChange={event => setForm({ ...form, shipping_policy: event.target.value })} placeholder="Explain processing time, delivery expectations, shipping methods, and how customers can get help." /></label>
            <label className={s.field}>Return & refund policy<textarea rows={6} maxLength={10000} value={form.refund_policy} onChange={event => setForm({ ...form, refund_policy: event.target.value })} placeholder="Explain your return window, damaged-order process, and how customers request help." /></label>
          </div></section>
        </div>
        <div>
          <section className={s.panel}><h3>Payment connection</h3>
            {payment ? <ul className={s.setupList}><li>{payment.stripe ? "✓" : "○"} Payment account</li><li>{payment.webhook ? "✓" : "○"} Payment confirmations</li><li>{payment.database ? "✓" : "○"} Order storage</li><li>{payment.email ? "✓" : "○"} Owner email alerts</li></ul> : <p className={s.help}>Payment setup could not be checked. Refresh to try again.</p>}
            <p className={s.help}>{payment?.ready ? payment.testMode ? "Test mode is connected. Orders will not charge real money or change live inventory." : "Live payment settings are present. Complete your checkout tests before opening." : "Payments are awaiting connection. You can prepare and publish product listings now."}</p>
          </section>
          <section className={s.panel}><h3>Accept orders</h3><label className={s.checkbox}><input type="checkbox" checked={form.store_open} disabled={!payment?.ready && !form.store_open} onChange={event => setForm({ ...form, store_open: event.target.checked })} /><span>{payment?.testMode ? "Open checkout in test mode" : "Open checkout"}</span></label><p className={s.help}>Published products can be viewed while checkout is closed. Save your settings to apply this change.</p></section>
        </div>
      </div>
      <div className={s.actions}><button className={s.primary} type="submit">{busy ? "Saving…" : "Save shop settings"}</button></div>
    </fieldset>
  </form>;
}
