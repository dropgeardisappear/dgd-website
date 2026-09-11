import "server-only";
import Stripe from "stripe";
import { createHash, createHmac } from "node:crypto";
import { Resend } from "resend";
import { getProductRows, getShopSettings } from "./catalog";
import { readCart, renewCart } from "./cart";
import { CartUpdateError, paymentDatabase, ShopUnavailableError } from "./supabase-server";
import { validateCheckoutUrl } from "./validation";
import type { ShopOrder } from "./database-types";
import { quoteShipping } from "./shipping";

export function paymentSetup() {
  const database = Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
  const stripe = /^(sk|rk)_(test|live)_/.test(process.env.STRIPE_SECRET_KEY || "");
  const webhook = Boolean(process.env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_"));
  return { ready: database && stripe && webhook, database, stripe, webhook, testMode: /^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY || ""), email: Boolean(process.env.RESEND_API_KEY && process.env.SHOP_FROM_EMAIL) };
}

export function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new ShopUnavailableError("Checkout is not available yet.");
  return new Stripe(key, { maxNetworkRetries: 1, timeout: 12000 });
}

export function siteOrigin() {
  const value = process.env.SHOP_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://www.dropgeardisappear.us");
  const url = new URL(value);
  if (url.username || url.password || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) throw new ShopUnavailableError("Invalid shop address.");
  return url.origin;
}

async function ownerOrderEmail(orderId: string) {
  if (!process.env.RESEND_API_KEY || !process.env.SHOP_FROM_EMAIL) return;
  const db = paymentDatabase();
  const { data: order, error } = await db.from("shop_orders").select("id,order_number,total_cents,livemode,status,notification_sent_at").eq("id", orderId).single();
  if (error) throw new Error("Could not read order notification state.");
  if (order.notification_sent_at || order.status !== "paid") return;
  const settings = await getShopSettings();
  if (!settings.support_email) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: process.env.SHOP_FROM_EMAIL, to: settings.support_email,
    subject: `${order.livemode ? "" : "[TEST] "}DGD order #${order.order_number} paid`,
    text: `Order #${order.order_number} is paid.\nTotal: $${(order.total_cents / 100).toFixed(2)} USD\n\nView the items and shipping address in your shop dashboard:\n${siteOrigin()}/admin/shop?tab=orders\n\n${order.livemode ? "" : "This is a test order. Do not ship it."}`,
  }, { idempotencyKey: `dgd-order-${order.id}` });
  if (result.error) throw new Error("Order email is waiting to be delivered.");
  const saved = await db.from("shop_orders").update({ notification_sent_at: new Date().toISOString() }).eq("id", order.id);
  if (saved.error) throw new Error("Could not save notification state.");
}

function failedSession(session: Stripe.Checkout.Session) {
  const intent = typeof session.payment_intent === "object" ? session.payment_intent : null;
  return session.payment_status !== "paid" && session.status === "complete" && Boolean(intent && ["requires_payment_method", "canceled"].includes(intent.status));
}

export async function syncSession(sessionId: string, notify = true, paymentFailed = false) {
  const stripe = stripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent.latest_charge"] });
  const db = paymentDatabase();
  const lookup = await db.from("shop_orders").select("*").eq("stripe_session_id", session.id).maybeSingle();
  if (lookup.error) throw new Error("Could not load payment record.");
  const order = lookup.data as ShopOrder | null;
  if (!order) return null; // Other checkouts in this Stripe account are not DGD orders.
  if (session.livemode !== order.livemode || session.client_reference_id !== order.cart_key || session.metadata?.dgd_cart_key !== order.cart_key || session.currency !== "usd") throw new Error("Payment does not match the order.");
  const state = session.payment_status === "paid" ? "paid" : session.status === "expired" ? "expired" : failedSession(session) ? "failed" : null;
  if (paymentFailed && !state) throw new Error("Payment failure has not been confirmed yet.");
  if (state) {
    const shipping = session.collected_information?.shipping_details;
    const settled = await db.rpc("shop_settle_order", {
      p_session_id: session.id, p_state: state, p_livemode: session.livemode,
      p_payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null,
      p_subtotal: session.amount_subtotal, p_shipping: session.total_details?.amount_shipping ?? 0,
      p_tax: session.total_details?.amount_tax ?? 0, p_total: session.amount_total,
      p_email: session.customer_details?.email || null, p_name: shipping?.name || session.customer_details?.name || null,
      p_address: shipping?.address || null,
    });
    if (settled.error) throw new Error("Could not confirm payment. The order needs another synchronization attempt.");
    // Refund events can arrive before completion events. Reconcile the current
    // charge here too, so a previously refunded payment is not shown as shippable.
    if (state === "paid" && typeof session.payment_intent === "object" && session.payment_intent) {
      const charge = session.payment_intent.latest_charge;
      if (charge && typeof charge === "object") await saveRefund(charge);
    }
    if (state === "paid" && notify) await ownerOrderEmail(order.id);
  }
  return session;
}

async function saveRefund(charge: Stripe.Charge) {
  const intent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!intent || charge.currency !== "usd") return;
  const result = await paymentDatabase().from("shop_orders").update({ refunded_cents: charge.amount_refunded })
    .eq("stripe_payment_intent", intent).eq("livemode", charge.livemode).lt("refunded_cents", charge.amount_refunded);
  if (result.error) throw new Error("Could not update refund status.");
}

export async function syncRefund(chargeId: string) {
  await saveRefund(await stripeClient().charges.retrieve(chargeId));
}

async function existingCheckout(order: ShopOrder) {
  const session = await syncSession(order.stripe_session_id, false);
  const cart = await readCart();
  if (session?.status === "open" && session.url) {
    if (!cart || cart.key !== order.cart_key) throw new CartUpdateError("Your cart changed. Refresh before continuing.");
    const quote = await quoteShipping(cart.lines);
    if (quote.subtotal_cents !== order.subtotal_cents || quote.shipping_cents !== order.shipping_cents || quote.method !== order.shipping_details?.method || JSON.stringify(quote.packing) !== JSON.stringify(order.shipping_details?.packing)) {
      await releaseCheckoutForCartEdit();
      throw new CartUpdateError("Prices or shipping changed. Review your cart and press Checkout again.");
    }
    return validateCheckoutUrl(session.url);
  }
  if (cart && cart.key === order.cart_key && session && (session.status === "expired" || failedSession(session))) await renewCart(cart);
  if (session?.payment_status === "paid") throw new CartUpdateError("This order is already paid. Check your confirmation before placing another order.");
  if (session && failedSession(session)) throw new CartUpdateError("Your payment did not go through. Review your cart and press Checkout to try again.");
  if (session?.status === "complete") throw new CartUpdateError("Your payment is still processing. Check your order confirmation before trying again.");
  throw new CartUpdateError("Your previous checkout expired. Review your cart and press Checkout again.");
}

export async function releaseCheckoutForCartEdit() {
  const cart = await readCart();
  if (!cart || !paymentSetup().ready) return;
  const prior = await paymentDatabase().from("shop_orders").select("stripe_session_id,status")
    .eq("cart_key", cart.key).eq("livemode", !paymentSetup().testMode).maybeSingle();
  if (prior.error) throw new ShopUnavailableError("Your checkout could not be checked. Please try again.");
  if (!prior.data || prior.data.status === "expired" || prior.data.status === "failed") return;
  if (prior.data.status === "pending") {
    // An expiry request can race a completed payment. Always retrieve Stripe's
    // current state before releasing stock or changing the cart identity.
    await stripeClient().checkout.sessions.expire(prior.data.stripe_session_id).catch(() => undefined);
    const session = await syncSession(prior.data.stripe_session_id, false);
    if (session && (session.status === "expired" || failedSession(session))) { await renewCart(cart); return; }
    if (session?.payment_status !== "paid") throw new ShopUnavailableError("Checkout could not be closed yet. Please try again.");
  }
  throw new CartUpdateError("This order is already paid. Open your order confirmation before starting a new cart.");
}

export async function createCheckout(request: Request) {
  if (!paymentSetup().ready) throw new ShopUnavailableError("Checkout is not available yet.");
  const settings = await getShopSettings();
  if (!settings.store_open) throw new CartUpdateError("The shop is not open for orders yet.");
  const cart = await readCart();
  if (!cart?.lines.length) throw new CartUpdateError("Your cart is empty.");
  const db = paymentDatabase();
  const stripe = stripeClient();
  const livemode = !paymentSetup().testMode;
  const prior = await db.from("shop_orders").select("*").eq("cart_key", cart.key).eq("livemode", livemode).maybeSingle();
  if (prior.error) throw new ShopUnavailableError("Checkout is temporarily unavailable.");
  if (prior.data) return existingCheckout(prior.data as ShopOrder);
  const products = await getProductRows(cart.lines.map(line => line.productId));
  const items = cart.lines.map(line => {
    const product = products.find(product => product.id === line.productId);
    if (!product?.price_cents || product.stock_quantity - product.reserved_quantity < line.quantity) throw new CartUpdateError("An item is no longer available in that quantity. Please update your cart.");
    return { product, quantity: line.quantity };
  });
  const subtotal = items.reduce((sum, item) => sum + item.product.price_cents! * item.quantity, 0);
  if (subtotal > 99999999) throw new CartUpdateError("This order is too large.");
  const quote = await quoteShipping(cart.lines);
  if (quote.subtotal_cents !== subtotal) throw new CartUpdateError("An item price changed. Refresh your cart.");
  const shipping = quote.shipping_cents;
  if (settings.tax_mode === "unconfigured" || !settings.shipping_countries.every(country => /^[A-Z]{2}$/.test(country)) || (quote.method === "stamped_letters" && settings.shipping_countries.join(",") !== "US")) throw new ShopUnavailableError("Shipping is not available yet.");
  const base = siteOrigin();
  // A stable time window makes retries idempotent while limiting unpaid stock
  // reservations to 30–40 minutes. A DB lock also deduplicates across windows.
  const timeWindow = Math.floor(Date.now() / 600000);
  const fingerprint = createHash("sha256").update(JSON.stringify({ items: items.map(item => [item.product.id, item.quantity, item.product.price_cents, item.product.updated_at]), shipping, tax: settings.tax_mode, countries: settings.shipping_countries, base })).digest("hex").slice(0, 32);
  const session = await stripe.checkout.sessions.create({
    mode: "payment", integration_identifier: "dgd_shop_jxqvmzpk", client_reference_id: cart.key,
    ...(process.env.STRIPE_PAYMENT_METHOD_CONFIGURATION ? { payment_method_configuration: process.env.STRIPE_PAYMENT_METHOD_CONFIGURATION } : {}),
    metadata: { dgd_cart_key: cart.key }, payment_intent_data: { metadata: { dgd_cart_key: cart.key } },
    line_items: items.map(({ product, quantity }) => ({ quantity, price_data: {
      currency: "usd", unit_amount: product.price_cents!, tax_behavior: "exclusive",
      product_data: { name: product.title, metadata: { dgd_product_id: product.id },
        ...(product.images[0]?.url.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/shop-product-images/`) ? { images: [product.images[0].url] } : {}),
      },
    } })),
    shipping_address_collection: { allowed_countries: settings.shipping_countries as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] },
    shipping_options: [{ shipping_rate_data: { type: "fixed_amount", display_name: quote.method === "stamped_letters" ? "USPS stamped mail (no tracking)" : shipping === 0 ? "Free shipping" : "Standard shipping", fixed_amount: { amount: shipping, currency: "usd" }, tax_behavior: "exclusive" } }],
    automatic_tax: { enabled: settings.tax_mode === "stripe_tax" },
success_url: `https://dropgeardisappear.us/shop/complete?session_id={CHECKOUT_SESSION_ID}`,
cancel_url: `https://dropgeardisappear.us/shop/cart`,
    expires_at: (timeWindow + 1) * 600 + 1800,
  }, { idempotencyKey: `dgd-${cart.key}-${livemode}-${timeWindow}-${fingerprint}` });
  if (session.livemode !== livemode || !session.url) throw new ShopUnavailableError("Checkout is temporarily unavailable.");
  const ip = process.env.VERCEL ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown" : "local";
  const clientHash = createHmac("sha256", process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!).update(ip).digest("hex");
  const result = await db.rpc("shop_reserve_order", {
    p_cart_key: cart.key, p_session_id: session.id, p_livemode: livemode, p_client_hash: clientHash,
    p_shipping_cents: shipping, p_tax_mode: settings.tax_mode,
    p_items: items.map(item => ({ product_id: item.product.id, unit_price_cents: item.product.price_cents, quantity: item.quantity })),
  });
  if (result.error) {
    // A transport failure might occur after COMMIT. Never expire or release a
    // possibly attached Session until the database confirms its ownership.
    const saved = await db.from("shop_orders").select("*").eq("cart_key", cart.key).eq("livemode", livemode).maybeSingle();
    if (saved.error) throw new ShopUnavailableError("Checkout is temporarily unavailable. Please try again.");
    if (saved.data) return existingCheckout(saved.data as ShopOrder);
    await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
    const expected = /^(An item|Too many checkout|Shipping changed|The shop is not ready|This order is too large)/.test(result.error.message);
    if (expected) throw new CartUpdateError(result.error.message);
    throw new ShopUnavailableError("Checkout is temporarily unavailable. Please try again.");
  }
  const order = result.data as ShopOrder;
  if (order.stripe_session_id !== session.id) {
    await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
    return existingCheckout(order);
  }
  return validateCheckoutUrl(session.url);
}
