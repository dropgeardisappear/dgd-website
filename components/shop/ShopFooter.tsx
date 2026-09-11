import Link from "next/link";
import { getShopPolicies, shopIsConfigured } from "@/lib/shop/shopify";
import styles from "./shop.module.css";

export default async function ShopFooter() {
  const policies = shopIsConfigured() ? await getShopPolicies().catch(() => null) : null;
  const shipping = policies?.shippingPolicy?.url;
  const returns = policies?.refundPolicy?.url;
  return (
    <footer className={styles.footer}>
      <div><strong>DROP GEAR DISAPPEAR</strong><p>Built after dark.</p></div>
      <nav aria-label="Shop information">
        {shipping?.startsWith("https://") && <a href={shipping}>Shipping</a>}
        {returns?.startsWith("https://") && <a href={returns}>Returns</a>}
        <Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/">The community</Link>
      </nav>
    </footer>
  );
}
