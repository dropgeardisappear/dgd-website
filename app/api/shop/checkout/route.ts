import { NextResponse } from "next/server";
import { assertSameOrigin, ShopInputError } from "@/lib/shop/validation";
import { buyerIP, CartUpdateError, getCheckoutUrl } from "@/lib/shop/shopify";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    assertSameOrigin(request);
    // Prices, quantities, and checkout destination come from Shopify, never the browser.
    const checkoutUrl = await getCheckoutUrl(buyerIP(request));
    return NextResponse.json({ checkoutUrl }, { headers });
  } catch (error) {
    const expected = error instanceof ShopInputError || error instanceof CartUpdateError;
    return NextResponse.json({ error: expected ? error.message : "Checkout is temporarily unavailable. Your cart is saved; please try again shortly." }, { status: expected ? 400 : 503, headers });
  }
}
