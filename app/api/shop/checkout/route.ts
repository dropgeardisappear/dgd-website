import { NextResponse } from "next/server";
import { assertSameOrigin, ShopInputError } from "@/lib/shop/validation";
import { CartUpdateError } from "@/lib/shop/supabase-server";
import { createCheckout } from "@/lib/shop/payments";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    assertSameOrigin(request);
    // Product prices are loaded on the server; inventory is reserved atomically.
    const checkoutUrl = await createCheckout(request);
    return NextResponse.json({ checkoutUrl }, { headers });
  } catch (error) {
    const expected = error instanceof ShopInputError || error instanceof CartUpdateError;
    return NextResponse.json({ error: expected ? error.message : "Checkout is temporarily unavailable. Your cart is saved; please try again shortly." }, { status: expected ? 400 : 503, headers });
  }
}
