import type { Metadata } from "next";
import { Suspense } from "react";
import ShopHeader from "@/components/shop/ShopHeader";
import ShopFooter from "@/components/shop/ShopFooter";
import styles from "@/components/shop/shop.module.css";

export const metadata: Metadata = {
  title: { default: "Shop | Drop Gear Disappear", template: "%s | DGD Shop" },
  description: "Shop Drop Gear Disappear stickers and merchandise.",
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.shell}>
    <a className={styles.skipLink} href="#shop-content">Skip to content</a>
    <ShopHeader />
    <main id="shop-content" className={styles.main}>{children}</main>
    <Suspense fallback={null}><ShopFooter /></Suspense>
  </div>;
}
