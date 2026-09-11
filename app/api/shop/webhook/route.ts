import { NextResponse } from "next/server";
import { stripeClient, syncRefund, syncSession } from "@/lib/shop/payments";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "Payment notifications are not configured." }, { status: 503 });
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  const raw = await request.text();
  if (raw.length > 1000000) return NextResponse.json({ error: "Request too large." }, { status: 413 });
  let event: Stripe.Event;
  try { event = stripeClient().webhooks.constructEvent(raw, signature, secret); }
  catch { return NextResponse.json({ error: "Invalid signature." }, { status: 400 }); }
  try {
    if (["checkout.session.completed", "checkout.session.expired", "checkout.session.async_payment_succeeded"].includes(event.type)) {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.dgd_cart_key) await syncSession(session.id);
    } else if (event.type === "charge.refunded") {
      await syncRefund((event.data.object as Stripe.Charge).id);
    }
    return NextResponse.json({ received: true });
  } catch {
    // A non-2xx response asks Stripe to retry. Database transitions are idempotent.
    console.error("DGD payment notification needs retry", { eventId: event.id, eventType: event.type });
    return NextResponse.json({ error: "Payment confirmation will be retried." }, { status: 503 });
  }
}
