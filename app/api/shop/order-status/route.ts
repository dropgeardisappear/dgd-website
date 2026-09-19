import { NextResponse } from "next/server";
import { readCart, saveCart } from "@/lib/shop/cart";
import { paymentDatabase } from "@/lib/shop/supabase-server";
import { syncSession } from "@/lib/shop/payments";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function GET(request: Request) {
  try {
    const sessionId = new URL(request.url).searchParams.get("session_id");
    const cart = await readCart();
    if (!sessionId || !/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(sessionId) || !cart) return NextResponse.json({ error: "Open your order confirmation in the browser you used to check out." }, { status: 404, headers });
    const db = paymentDatabase();
    const initial = await db.from("shop_orders").select("id,status").eq("cart_key", cart.key).eq("stripe_session_id", sessionId).maybeSingle();
    if (initial.error) throw new Error();
    if (!initial.data) return NextResponse.json({ error: "Order confirmation not found." }, { status: 404, headers });
    if (initial.data.status === "pending") await syncSession(sessionId, false);
    const result = await db.from("shop_orders").select("order_number,status,total_cents,livemode").eq("id", initial.data.id).single();
    if (result.error) throw new Error();
    if (result.data.status === "paid" && cart.lines.length) await saveCart({ key: cart.key, lines: [] });
    return NextResponse.json(result.data, { headers });
  } catch {
    return NextResponse.json({ error: "Your payment confirmation is still being checked. Please try again." }, { status: 503, headers });
  }
}
