"use client";

import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import CartLink from "./CartLink";
import styles from "./shop.module.css";

export default function ShopHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const links = <>
    <Link href="/#culture" onClick={() => setOpen(false)}>Browse builds</Link>
    <Link href="/submit" onClick={() => setOpen(false)}>Submit build</Link>
    <Link href="/shop" aria-current={pathname === "/shop" ? "page" : undefined} onClick={() => setOpen(false)}>Shop</Link>
  </>;
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/" aria-label="Drop Gear Disappear home"><Image unoptimized src="/DGD 2 transparent.png" alt="DGD" width={140} height={55} className={styles.logo} /></Link>
        <nav aria-label="Main navigation" className={styles.desktopNav}>{links}</nav>
        <div className={styles.headerActions}>
          <CartLink />
          <button className={styles.menuToggle} type="button" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="shop-mobile-nav" onClick={() => setOpen(!open)}>{open ? <X size={22} /> : <Menu size={22} />}</button>
        </div>
      </div>
      {open && <nav className={styles.mobileNav} id="shop-mobile-nav" aria-label="Mobile navigation">{links}</nav>}
    </header>
  );
}
