import type { Metadata } from "next";
import OrderConfirmation from "@/components/shop/OrderConfirmation";

export const metadata: Metadata = { title: "Order confirmation", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function CompletePage({ searchParams }: { searchParams: Promise<{ session_id?: string | string[] }> }) {
  const params = await searchParams;
  return <OrderConfirmation sessionId={typeof params.session_id === "string" ? params.session_id : ""} />;
}
