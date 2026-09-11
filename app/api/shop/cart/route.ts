import { NextResponse } from "next/server";
import { assertSameOrigin, readShopBody, ShopInputError, validateLineId, validateQuantity, validateVariantId } from "@/lib/shop/validation";
import { buyerIP, CartUpdateError, forgetCart, getCart, mutateCart, publicCart, shopIsConfigured } from "@/lib/shop/shopify";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  try {
    if (!shopIsConfigured()) return NextResponse.json({ cart: null, enabled: false }, { headers });
    const cart = await getCart(buyerIP(request));
    if (!cart) await forgetCart();
    return NextResponse.json({ cart: publicCart(cart), enabled: true }, { headers });
  } catch {
    return NextResponse.json({ error: "Your cart could not be loaded. Please try again." }, { status: 503, headers });
  }
}

async function change(request: Request, action: "add" | "update" | "remove") {
  try {
    assertSameOrigin(request);
    const body = await readShopBody(request);
    const input = action === "add"
      ? { merchandiseId: validateVariantId(body.merchandiseId), quantity: validateQuantity(body.quantity) }
      : { lineId: validateLineId(body.lineId), ...(action === "update" ? { quantity: validateQuantity(body.quantity) } : {}) };
    if (!shopIsConfigured()) return NextResponse.json({ error: "The shop is not open yet." }, { status: 503, headers });
    return NextResponse.json(await mutateCart(action, input, buyerIP(request)), { headers });
  } catch (error) {
    if (error instanceof ShopInputError || error instanceof CartUpdateError) {
      return NextResponse.json({ error: error.message }, { status: 400, headers });
    }
    return NextResponse.json({ error: "The cart could not be updated. Please review your cart before trying again." }, { status: 503, headers });
  }
}

export const POST = (request: Request) => change(request, "add");
export const PATCH = (request: Request) => change(request, "update");
export const DELETE = (request: Request) => change(request, "remove");
