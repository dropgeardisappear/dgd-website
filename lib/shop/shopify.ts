import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { isIP } from "node:net";
import type { CartLine, Money, PageInfo, Product, ShopCart, Variant } from "./types";
import { validateCheckoutUrl, validateStoreDomain } from "./validation";

const imageFields = "url altText width height";
const moneyFields = "amount currencyCode";
const variantFields = `id title availableForSale price { ${moneyFields} } compareAtPrice { ${moneyFields} } selectedOptions { name value } image { ${imageFields} }`;
const productFields = `
  id handle title description productType availableForSale requiresSellingPlan
  featuredImage { ${imageFields} } images(first: 10) { nodes { ${imageFields} } }
  priceRange { minVariantPrice { ${moneyFields} } maxVariantPrice { ${moneyFields} } }
  options { name values }
  variants(first: 100) { nodes { ${variantFields} } pageInfo { hasNextPage endCursor } }
  metafields(identifiers: [
    { namespace: "custom", key: "dimensions" }, { namespace: "custom", key: "material" },
    { namespace: "custom", key: "finish" }, { namespace: "custom", key: "application_care" }
  ]) { key value }
  seo { title description }
`;
const lineFields = `id quantity cost { totalAmount { ${moneyFields} } } merchandise { ... on ProductVariant { ${variantFields} product { title handle } } }`;
const cartFields = `id checkoutUrl totalQuantity lines(first: 100) { nodes { ${lineFields} } pageInfo { hasNextPage endCursor } } cost { subtotalAmount { ${moneyFields} } totalAmount { ${moneyFields} } }`;

type RawCart = {
  id: string; checkoutUrl: string; totalQuantity: number;
  lines: { nodes: CartLine[]; pageInfo: PageInfo };
  cost: { subtotalAmount: Money; totalAmount: Money };
};
type MutationResult = { cart: RawCart | null; userErrors: { message: string }[]; warnings?: { message: string }[] };

export class ShopUnavailableError extends Error {}
export class CartUpdateError extends Error {}

export function shopIsConfigured() {
  return Boolean(process.env.SHOPIFY_STORE_DOMAIN?.trim() && process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN?.trim());
}

function config() {
  if (!shopIsConfigured()) throw new ShopUnavailableError("The shop is not open yet.");
  const domain = validateStoreDomain(process.env.SHOPIFY_STORE_DOMAIN!);
  const version = process.env.SHOPIFY_STOREFRONT_API_VERSION || "2026-07";
  if (!/^\d{4}-(01|04|07|10)$/.test(version)) throw new ShopUnavailableError("Invalid Storefront API version.");
  return { domain, version, token: process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN! };
}

async function storefront<T>(query: string, variables: Record<string, unknown> = {}, buyerIP?: string): Promise<T> {
  const { domain, version, token } = config();
  try {
    const response = await fetch(`https://${domain}/api/${version}/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Shopify-Storefront-Private-Token": token,
        ...(buyerIP && isIP(buyerIP) ? { "Shopify-Storefront-Buyer-IP": buyerIP } : {}),
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error("Shopify request failed.");
    const result = await response.json();
    if (result.errors?.length || !result.data) throw new Error("Shopify returned an API error.");
    return result.data as T;
  } catch {
    // Never expose upstream errors, private tokens, cart keys, or customer information.
    throw new ShopUnavailableError("The shop is temporarily unavailable. Please try again shortly.");
  }
}

export async function getProducts(after?: string) {
  return (await storefront<{ products: { nodes: Product[]; pageInfo: PageInfo } }>(
    `query Products($after: String) { products(first: 24, after: $after, sortKey: CREATED_AT, reverse: true) { nodes { ${productFields} } pageInfo { hasNextPage endCursor } } }`,
    { after: after || null },
  )).products;
}

export const getProduct = cache(async (handle: string) => {
  const data = await storefront<{ product: Product | null }>(
    `query Product($handle: String!) { product(handle: $handle) { ${productFields} } }`, { handle },
  );
  const product = data.product;
  if (!product) return null;
  while (product.variants.pageInfo.hasNextPage) {
    const next = await storefront<{ product: { variants: { nodes: Variant[]; pageInfo: PageInfo } } }>(
      `query Variants($handle: String!, $after: String!) { product(handle: $handle) { variants(first: 100, after: $after) { nodes { ${variantFields} } pageInfo { hasNextPage endCursor } } } }`,
      { handle, after: product.variants.pageInfo.endCursor },
    );
    product.variants.nodes.push(...next.product.variants.nodes);
    product.variants.pageInfo = next.product.variants.pageInfo;
  }
  return product;
});

export async function getShopPolicies() {
  const { shop } = await storefront<{ shop: {
    shippingPolicy: { url: string } | null; refundPolicy: { url: string } | null;
  } }>("query Policies { shop { shippingPolicy { url } refundPolicy { url } } }");
  return shop;
}

export const CART_COOKIE = process.env.NODE_ENV === "production" ? "__Host-dgd-shop-cart" : "dgd-shop-cart";

export async function getCartId() {
  return (await cookies()).get(CART_COOKIE)?.value;
}

export async function rememberCart(id: string) {
  (await cookies()).set(CART_COOKIE, id, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 10,
  });
}

export async function forgetCart() {
  (await cookies()).delete(CART_COOKIE);
}

export function publicCart(cart: RawCart | null): ShopCart | null {
  if (!cart) return null;
  return { totalQuantity: cart.totalQuantity, lines: cart.lines.nodes, cost: cart.cost };
}

async function completeCart(cart: RawCart, buyerIP?: string) {
  while (cart.lines.pageInfo.hasNextPage) {
    const { cart: next } = await storefront<{ cart: RawCart | null }>(
      `query CartLines($id: ID!, $after: String!) { cart(id: $id) { lines(first: 100, after: $after) { nodes { ${lineFields} } pageInfo { hasNextPage endCursor } } } }`,
      { id: cart.id, after: cart.lines.pageInfo.endCursor }, buyerIP,
    );
    if (!next) throw new CartUpdateError("Your cart expired. Please refresh and add your items again.");
    cart.lines.nodes.push(...next.lines.nodes);
    cart.lines.pageInfo = next.lines.pageInfo;
  }
  return cart;
}

export async function getCart(buyerIP?: string) {
  const id = await getCartId();
  if (!id || !shopIsConfigured()) return null;
  const { cart } = await storefront<{ cart: RawCart | null }>(
    `query Cart($id: ID!) { cart(id: $id) { ${cartFields} } }`, { id }, buyerIP,
  );
  return cart ? completeCart(cart, buyerIP) : null;
}

export async function mutateCart(action: "add" | "update" | "remove", input: { merchandiseId?: string; lineId?: string; quantity?: number }, buyerIP?: string) {
  const existing = await getCart(buyerIP);
  if (action !== "add" && !existing) {
    await forgetCart();
    throw new CartUpdateError("Your cart expired. Please add your items again.");
  }
  // Only line IDs belonging to this visitor's server-held cart may be changed.
  if (action !== "add" && !existing!.lines.nodes.some((line) => line.id === input.lineId)) {
    throw new CartUpdateError("That item is no longer in your cart. Refresh your cart.");
  }
  if (action === "add" && existing) {
    const quantity = existing.lines.nodes.filter((line) => line.merchandise.id === input.merchandiseId).reduce((sum, line) => sum + line.quantity, 0);
    if (quantity + input.quantity! > 99) throw new CartUpdateError("You can order up to 99 of each item at a time.");
  }
  const selection = `{ cart { ${cartFields} } userErrors { message } warnings { message } }`;
  let data: Record<string, MutationResult>;
  if (!existing) {
    data = await storefront(`mutation CreateCart($input: CartInput!) { cartCreate(input: $input) ${selection} }`, {
      input: { lines: [{ merchandiseId: input.merchandiseId, quantity: input.quantity }] },
    }, buyerIP);
  } else if (action === "add") {
    data = await storefront(`mutation AddLines($id: ID!, $lines: [CartLineInput!]!) { cartLinesAdd(cartId: $id, lines: $lines) ${selection} }`, {
      id: existing.id, lines: [{ merchandiseId: input.merchandiseId, quantity: input.quantity }],
    }, buyerIP);
  } else if (action === "update") {
    data = await storefront(`mutation UpdateLines($id: ID!, $lines: [CartLineUpdateInput!]!) { cartLinesUpdate(cartId: $id, lines: $lines) ${selection} }`, {
      id: existing.id, lines: [{ id: input.lineId, quantity: input.quantity }],
    }, buyerIP);
  } else {
    data = await storefront(`mutation RemoveLines($id: ID!, $lines: [ID!]!) { cartLinesRemove(cartId: $id, lineIds: $lines) ${selection} }`, {
      id: existing.id, lines: [input.lineId],
    }, buyerIP);
  }
  const result = Object.values(data)[0];
  if (result.userErrors.length) {
    throw new CartUpdateError("This change could not be completed. Check your cart and item availability, then try again.");
  }
  if (!result.cart) throw new CartUpdateError("The cart could not be updated. Please try again.");
  await rememberCart(result.cart.id);
  const cart = await completeCart(result.cart, buyerIP);
  return { cart: publicCart(cart), enabled: true, ...(result.warnings?.length ? { warning: "Your cart was adjusted to match current availability. Please review the quantities and total." } : {}) };
}

export async function getCheckoutUrl(buyerIP?: string) {
  const cart = await getCart(buyerIP);
  if (!cart?.totalQuantity) throw new CartUpdateError("Your cart is empty. Add an item before checking out.");
  if (cart.lines.nodes.some((line) => !line.merchandise.availableForSale)) {
    throw new CartUpdateError("An item is no longer available. Please update your cart.");
  }
  return validateCheckoutUrl(cart.checkoutUrl, config().domain, process.env.SHOPIFY_CHECKOUT_DOMAIN);
}

export function buyerIP(request: Request) {
  // Vercel supplies this header. Never accept an IP from the request body.
  if (!process.env.VERCEL) return undefined;
  const value = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return value && isIP(value) ? value : undefined;
}
