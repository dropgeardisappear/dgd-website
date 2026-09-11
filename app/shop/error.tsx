"use client";

import Link from "next/link";
import styles from "@/components/shop/shop.module.css";

export default function ShopError({ reset }: { reset: () => void }) {
  return <div className={styles.statusPanel}>
    <h2>The shop is taking a moment.</h2><p>We couldn’t load the latest products. Please try again shortly.</p>
    <button type="button" onClick={reset} className={styles.secondaryButton}>Try again</button><br />
    <Link href="/" className={styles.textLink}>Back to the community</Link>
  </div>;
}
