import Link from "next/link";
import styles from "@/components/shop/shop.module.css";

export default function NotFound() {
  return <div className={styles.statusPanel}><h2>That product isn’t here.</h2><p>It may have been removed or its link has changed.</p><Link href="/shop" className={styles.secondaryButton}>Back to shop</Link></div>;
}
