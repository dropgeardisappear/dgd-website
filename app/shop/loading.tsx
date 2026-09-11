import styles from "@/components/shop/shop.module.css";

export default function Loading() {
  return <div className={styles.statusPanel} role="status">Loading the shop…</div>;
}
