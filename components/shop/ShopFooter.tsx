import Link from "next/link";
import { getShopSettings, shopIsConfigured } from "@/lib/shop/catalog";
import styles from "./shop.module.css";

export default async function ShopFooter() {
  const settings = shopIsConfigured() ? await getShopSettings().catch(() => null) : null;
  return (
    <footer className={styles.footer}>
      <div><strong>DROP GEAR DISAPPEAR</strong><p>Built after dark.</p></div>
      <nav aria-label="Shop information">
        {settings?.shipping_policy && <Link href="/shop/policies/shipping">Shipping</Link>}
        {settings?.refund_policy && <Link href="/shop/policies/returns">Returns</Link>}
        {settings?.support_email && <a href={`mailto:${settings.support_email}`}>Contact</a>}
        <Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/">The community</Link>
      </nav>
    </footer>
  );
}
