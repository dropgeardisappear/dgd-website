import type { Metadata } from "next";
import { Suspense } from "react";
import ShopHeader from "@/components/shop/ShopHeader";
import ShopFooter from "@/components/shop/ShopFooter";
import ShippingNotice from "@/components/shop/ShippingNotice";
import styles from "@/components/shop/shop.module.css";
import { paymentSetup } from "@/lib/shop/payments";

export const metadata: Metadata = {
  title: { default: "Shop | Drop Gear Disappear", template: "%s | DGD Shop" },
  description: "Shop Drop Gear Disappear stickers and merchandise.",
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.shell}>
    <a className={styles.skipLink} href="#shop-content">Skip to content</a>
    <ShopHeader />
    <Suspense fallback={null}><ShippingNotice /></Suspense>
    {paymentSetup().ready && paymentSetup().testMode && <p className={styles.testBanner}>Test shop — orders are not charged or shipped.</p>}
    <main id="shop-content" className={styles.main}>{children}</main>
    <Suspense fallback={null}><ShopFooter /></Suspense>
  </div>;
}
