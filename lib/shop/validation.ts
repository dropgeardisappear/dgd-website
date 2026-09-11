export class ShopInputError extends Error {}

export function validateStoreDomain(value: string) {
  const domain = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)) {
    throw new ShopInputError("Use your store's myshopify.com domain, without https:// or a path.");
  }
  return domain;
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new ShopInputError("Please refresh the page and try again.");
  }
}

export function validateQuantity(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 99) {
    throw new ShopInputError("Choose a quantity between 1 and 99.");
  }
  return value;
}

export function validateVariantId(value: unknown) {
  if (typeof value !== "string" || !/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(value)) {
    throw new ShopInputError("Choose a valid product option.");
  }
  return value;
}

export function validateLineId(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("gid://shopify/CartLine/") || value.length > 512 || /[\s\x00-\x1f]/.test(value)) {
    throw new ShopInputError("That cart item could not be updated. Refresh your cart.");
  }
  return value;
}

export function validateCheckoutUrl(value: string, storeDomain: string, customDomain?: string) {
  const url = new URL(value);
  const hosts = new Set([storeDomain, "checkout.shopify.com", "shopify.com"]);
  if (customDomain) hosts.add(customDomain.trim().toLowerCase());
  if (url.protocol !== "https:" || url.username || url.password || url.port || !hosts.has(url.hostname)) {
    throw new Error("Unexpected checkout destination.");
  }
  return url.toString();
}

export async function readShopBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    throw new ShopInputError("Invalid request format.");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new ShopInputError("Missing request body.");
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 4096) {
      await reader.cancel();
      throw new ShopInputError("Request is too large.");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw new ShopInputError("Invalid request body.");
  }
}
