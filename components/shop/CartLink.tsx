"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "./CartProvider";

export default function CartLink() {
  const { cart, loading, error } = useCart();
  const count = !loading && !error ? cart?.totalQuantity ?? 0 : null;
  return (
    <Link href="/shop/cart" aria-label={count === null ? "Open shopping cart" : `Open shopping cart, ${count} items`} className="inline-flex min-h-11 items-center gap-2 text-sm text-white transition hover:text-orange-500">
      <ShoppingBag size={19} aria-hidden="true" />
      <span>Cart{count ? ` (${count})` : ""}</span>
    </Link>
  );
}
