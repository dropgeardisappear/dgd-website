export class ShopInputError extends Error {}

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
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new ShopInputError("Choose a valid product option.");
  }
  return value.toLowerCase();
}

export function validateLineId(value: unknown) {
  return validateVariantId(value);
}

export function validateCheckoutUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hostname !== "checkout.stripe.com") {
    throw new Error("Unexpected checkout destination.");
  }
  return url.toString();
}

export type CartData = { key: string; lines: { productId: string; quantity: number }[] };

export function parseCart(value: unknown): CartData | null {
  try {
    if (!value || typeof value !== "object") return null;
    const cart = value as CartData;
    const key = validateVariantId(cart.key);
    if (!Array.isArray(cart.lines) || cart.lines.length > 30) return null;
    const lines = cart.lines.map(line => ({ productId: validateVariantId(line.productId), quantity: validateQuantity(line.quantity) }));
    if (new Set(lines.map(line => line.productId)).size !== lines.length) return null;
    return { key, lines };
  } catch { return null; }
}

export function priceInCents(value: string): number | null {
  if (!value.trim()) return null;
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(value.trim())) throw new ShopInputError("Enter a price with up to two decimal places.");
  const [whole, fraction = ""] = value.trim().split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
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
