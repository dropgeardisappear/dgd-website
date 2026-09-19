import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/shop/validation";
import { requireShopOwner, paymentDatabase } from "@/lib/shop/supabase-server";
import { paymentSetup, syncSession } from "@/lib/shop/payments";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 403 }); }
  try {
    if (!await requireShopOwner(request)) return NextResponse.json({ error: "Shop owner access required." }, { status: 403 });
    if (!paymentSetup().ready) return NextResponse.json({ error: "Connect payments before syncing orders." }, { status: 503 });
    const { data, error } = await paymentDatabase().from("shop_orders").select("stripe_session_id").eq("livemode", !paymentSetup().testMode)
      .or(paymentSetup().email ? "status.eq.pending,and(status.eq.paid,notification_sent_at.is.null)" : "status.eq.pending")
      .order("status", { ascending: false }).order("created_at").limit(10);
    if (error) throw new Error();
    const results = await Promise.allSettled(data.map(order => syncSession(order.stripe_session_id)));
    return NextResponse.json({ synced: results.filter(result => result.status === "fulfilled").length, retry: results.filter(result => result.status === "rejected").length }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Some orders could not be checked. Please try again." }, { status: 503 }); }
}
