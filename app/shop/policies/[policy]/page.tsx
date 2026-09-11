import { notFound } from "next/navigation";
import { getShopSettings } from "@/lib/shop/catalog";
import styles from "@/components/shop/shop.module.css";

export const dynamic = "force-dynamic";
export default async function PolicyPage({ params }: { params: Promise<{ policy: string }> }) {
  const { policy } = await params;
  if (!["shipping", "returns"].includes(policy)) notFound();
  const settings = await getShopSettings();
  const content = policy === "shipping" ? settings.shipping_policy : settings.refund_policy;
  if (!content) notFound();
  return <article><div className={styles.pageHeading}><h1 className={styles.pageTitle}>{policy === "shipping" ? "Shipping" : "Returns"}</h1></div><p className={styles.description}>{content}</p></article>;
}
