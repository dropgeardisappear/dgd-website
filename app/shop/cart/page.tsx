import type { Metadata } from "next";
import CartPage from "@/components/shop/CartPage";
import styles from "@/components/shop/shop.module.css";

export const metadata: Metadata = { title: "Your cart", robots: { index: false, follow: false } };

export default function Page() {
  return <>
    <div className={styles.pageHeading}><div><p className={styles.eyebrow}>DGD SHOP</p><h1 className={styles.pageTitle}>Your cart.</h1></div></div>
    <CartPage />
  </>;
}
