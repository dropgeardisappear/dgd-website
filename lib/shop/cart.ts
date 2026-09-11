import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { getProductRows, toProduct } from "./catalog";
import { CartUpdateError, paymentDatabase, ShopUnavailableError } from "./supabase-server";
import { parseCart, type CartData } from "./validation";
import type { ShopCart } from "./types";
import { quoteShipping } from "./shipping";

const CART_COOKIE = process.env.NODE_ENV === "production" ? "__Host-dgd-cart-v2" : "dgd-cart-v2";

export async function readCart(): Promise<CartData | null> {
  const value = (await cookies()).get(CART_COOKIE)?.value;
  if (!value || value.length > 3800) return null;
  try { return parseCart(JSON.parse(Buffer.from(value, "base64url").toString("utf8"))); }
  catch { return null; }
}

export async function saveCart(cart: CartData) {
  (await cookies()).set(CART_COOKIE, Buffer.from(JSON.stringify(cart)).toString("base64url"), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 10,
  });
}

export async function forgetCart() { (await cookies()).delete(CART_COOKIE); }
export async function renewCart(cart: CartData) { await saveCart({ ...cart, key: randomUUID() }); }

export async function publicCart(cart: CartData | null): Promise<ShopCart | null> {
  if (!cart?.lines.length) return null;
  const products = await getProductRows(cart.lines.map(line => line.productId));
  let reserved: { product_id: string; quantity: number }[] = [];
  let confirmationUrl: string | undefined;
  if (process.env.STRIPE_SECRET_KEY && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    const order = await paymentDatabase().from("shop_orders").select("status,stripe_session_id,livemode,shop_order_items(product_id,quantity)")
      .eq("cart_key", cart.key).eq("livemode", /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY)).maybeSingle();
    if (order.error) throw new ShopUnavailableError("Your cart could not be loaded.");
    if (order.data?.status === "pending" && order.data.livemode) reserved = order.data.shop_order_items || [];
    if (order.data?.status === "paid") confirmationUrl = `/shop/complete?session_id=${encodeURIComponent(order.data.stripe_session_id)}`;
  }
  let subtotal = 0;
  const lines = cart.lines.map(line => {
    const row = products.find(product => product.id === line.productId);
    const product = row ? toProduct(row) : null;
    const priceCents = row?.price_cents || 0;
    const ownReservation = reserved.find(item => item.product_id === line.productId)?.quantity || 0;
    subtotal += priceCents * line.quantity;
    const money = (amount: number) => ({ amount: (amount / 100).toFixed(2), currencyCode: "USD" });
    return { id: line.productId, quantity: line.quantity, cost: { totalAmount: money(priceCents * line.quantity) }, merchandise: {
      id: line.productId, title: "Default Title", availableForSale: Boolean(row && priceCents && row.stock_quantity - row.reserved_quantity + ownReservation >= line.quantity),
      price: money(priceCents), compareAtPrice: null, selectedOptions: [], image: product?.featuredImage || null,
      product: { title: product?.title || "Unavailable item", handle: product?.handle || "unavailable" },
    } };
  });
  const total = { amount: (subtotal / 100).toFixed(2), currencyCode: "USD" };
  let shipping: ShopCart["shipping"], shippingError: string | undefined;
  let totalWithShipping = total;
  try {
    const quote = await quoteShipping(cart.lines);
    if (quote.subtotal_cents !== subtotal) throw new CartUpdateError("An item price changed. Refresh your cart.");
    shipping = { amount: { amount: (quote.shipping_cents / 100).toFixed(2), currencyCode: "USD" }, label: quote.method === "stamped_letters" ? "U.S. stamped mail · no tracking" : "Shipping", envelopeCount: quote.envelope_count };
    totalWithShipping = { amount: ((subtotal + quote.shipping_cents) / 100).toFixed(2), currencyCode: "USD" };
  } catch (error) { shippingError = error instanceof Error ? error.message : "Shipping could not be calculated."; }
  return { lines, totalQuantity: lines.reduce((sum, line) => sum + line.quantity, 0), cost: { subtotalAmount: total, totalAmount: totalWithShipping }, shipping, shippingError, ...(confirmationUrl ? { confirmationUrl } : {}) };
}

export async function mutateCart(action: "add" | "update" | "remove", input: { merchandiseId?: string; lineId?: string; quantity?: number }) {
  const cart = await readCart() || { key: randomUUID(), lines: [] };
  const id = action === "add" ? input.merchandiseId! : input.lineId!;
  const existing = cart.lines.find(line => line.productId === id);
  if (action !== "add" && !existing) throw new CartUpdateError("That item is no longer in your cart. Refresh your cart.");
  if (action === "remove") cart.lines = cart.lines.filter(line => line.productId !== id);
  else {
    const quantity = action === "add" ? (existing?.quantity || 0) + input.quantity! : input.quantity!;
    if (quantity > 99) throw new CartUpdateError("You can order up to 99 of each item at a time.");
    if (!existing && cart.lines.length >= 30) throw new CartUpdateError("You can add up to 30 different products per order.");
    const [product] = await getProductRows([id]);
    if (!product || !product.price_cents) throw new CartUpdateError("This item is no longer available.");
    if (product.stock_quantity - product.reserved_quantity < quantity) throw new CartUpdateError("There is not enough stock for that quantity.");
    if (existing) existing.quantity = quantity;
    else cart.lines.push({ productId: id, quantity });
  }
  cart.key = randomUUID();
  await saveCart(cart);
  return publicCart(cart);
}
