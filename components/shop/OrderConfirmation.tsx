"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useCart } from "./CartProvider";
import { usd } from "@/lib/shop/database-types";
import styles from "./shop.module.css";

type Confirmation = { order_number: number; status: string; total_cents: number | null; livemode: boolean };
export default function OrderConfirmation({ sessionId }: { sessionId: string }) {
  const [order, setOrder] = useState<Confirmation | null>(null);
  const [message, setMessage] = useState("Confirming your payment…");
  const [attempt, setAttempt] = useState(0);
  const { refresh } = useCart();
  useEffect(() => {
    let stopped = false; let timer: ReturnType<typeof setTimeout>; let count = 0;
    const check = async () => {
      try {
        const response = await fetch(`/api/shop/order-status?session_id=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
        const data = await response.json();
        if (stopped) return;
        if (!response.ok) throw new Error(data.error || "Your payment is still being checked.");
        setOrder(data);
        if (data.status === "paid") { await refresh(); return; }
        setMessage(data.status === "expired" ? "This checkout expired. You can return to your cart." : "We’re waiting for payment confirmation. Please don’t place the order again.");
        if (data.status === "pending" && ++count < 6) timer = setTimeout(check, 2000);
      } catch (error) { if (!stopped) setMessage(error instanceof Error ? error.message : "Please check again shortly."); }
    };
    void check();
    return () => { stopped = true; clearTimeout(timer); };
  }, [sessionId, attempt, refresh]);
  return <div className={styles.emptyCart}>
    {order?.status === "paid" ? <><CheckCircle2 size={48} /><h1 className={styles.productTitle}>{order.livemode ? "You’re all set." : "Test order confirmed."}</h1><p>Order #{order.order_number}{order.total_cents !== null && <> · {usd(order.total_cents)}</>}{!order.livemode && <><br />No live payment was collected.</>}</p><Link className={styles.primaryButton} href="/shop">Back to shop</Link></> : <><h1 className={styles.productTitle}>Order confirmation</h1><p role="status">{message}</p><button className={styles.secondaryButton} onClick={() => setAttempt(attempt + 1)}>Check again</button><Link className={styles.textLink} href="/shop/cart">Return to cart</Link></>}
  </div>;
}
