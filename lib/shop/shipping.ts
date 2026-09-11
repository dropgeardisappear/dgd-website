import "server-only";
import { shopDatabase, CartUpdateError, ShopUnavailableError } from "./supabase-server";
import type { ShippingQuote } from "./database-types";

export async function quoteShipping(lines: { productId: string; quantity: number }[]): Promise<ShippingQuote> {
  const { data, error } = await shopDatabase().rpc("shop_quote_shipping", {
    p_items: lines.map(line => ({ product_id: line.productId, quantity: line.quantity })),
  });
  if (error) {
    if (/^(Shipping|An item|This order)/.test(error.message)) throw new CartUpdateError(error.message);
    throw new ShopUnavailableError("Shipping could not be calculated. Please try again.");
  }
  return data as ShippingQuote;
}
