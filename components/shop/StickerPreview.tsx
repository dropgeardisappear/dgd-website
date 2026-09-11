import Image from "next/image";
import styles from "./shop.module.css";

export default function StickerPreview() {
  return (
    <section className={styles.productLayout} aria-labelledby="sticker-title">
      <div className={styles.productImage}>
        <span className={styles.imageTag}>DGD ORIGINAL</span>
        <Image src="/dgd-logo-sticker.png" alt="Black and white DGD logo sticker with pinstriping and wheel artwork" width={1774} height={887} priority sizes="(max-width: 760px) 100vw, 60vw" />
      </div>
      <div className={styles.productInfo}>
        <p className={styles.eyebrow}>DROP GEAR DISAPPEAR / STICKERS</p>
        <h2 id="sticker-title" className={styles.productTitle}>DGD Logo<br />Sticker</h2>
        <p className={styles.description}>The DGD logo in black and white. Pinstriping, wheel details, and a little garage attitude.</p>
        <div className={styles.releaseStatus}>Coming soon</div>
        <button className={styles.primaryButton} disabled type="button">Available when the shop opens</button>
      </div>
    </section>
  );
}
