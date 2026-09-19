import { NextResponse } from "next/server";
import { assertSameOrigin, readShopBody, ShopInputError, validateLineId, validateQuantity, validateVariantId } from "@/lib/shop/validation";
import { readCart, mutateCart, publicCart } from "@/lib/shop/cart";
import { CartUpdateError, shopIsConfigured } from "@/lib/shop/supabase-server";
import { getShopSettings } from "@/lib/shop/catalog";
import { paymentSetup, releaseCheckoutForCartEdit } from "@/lib/shop/payments";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  try {
    if (!shopIsConfigured()) return NextResponse.json({ cart: null, enabled: false }, { headers });
    const settings = await getShopSettings();
    return NextResponse.json({ cart: await publicCart(await readCart()), enabled: settings.store_open && paymentSetup().ready }, { headers });
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
    const settings = await getShopSettings();
    const enabled = settings.store_open && paymentSetup().ready;
    if (action === "add" && !enabled) return NextResponse.json({ error: "The shop is not open yet." }, { status: 503, headers });
    await releaseCheckoutForCartEdit();
    return NextResponse.json({ cart: await mutateCart(action, input), enabled }, { headers });
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
