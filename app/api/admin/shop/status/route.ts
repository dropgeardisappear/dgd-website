import { NextResponse } from "next/server";
import { requireShopOwner } from "@/lib/shop/supabase-server";
import { paymentSetup } from "@/lib/shop/payments";

export async function GET(request: Request) {
  try {
    if (!await requireShopOwner(request)) return NextResponse.json({ error: "Shop owner access required." }, { status: 403 });
    return NextResponse.json(paymentSetup(), { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Payment setup could not be checked." }, { status: 503 }); }
}
