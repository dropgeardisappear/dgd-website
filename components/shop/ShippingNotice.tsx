import { getShopSettings } from "@/lib/shop/catalog";
import { usd } from "@/lib/shop/database-types";
import styles from "./shop.module.css";

export default async function ShippingNotice() {
  const settings = await getShopSettings().catch(() => null);
  if (settings?.shipping_mode !== "stamped_letters") return null;
  return <p className={styles.shippingNotice}>U.S. stamped mail · {usd(settings.letter_rate_cents)} per envelope · No tracking</p>;
}
