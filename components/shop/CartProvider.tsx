"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { CartResponse, ShopCart } from "@/lib/shop/types";

type CartContextValue = {
  cart: ShopCart | null; enabled: boolean; loading: boolean; busy: boolean; error: string;
  refresh: () => Promise<void>;
  change: (method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) => Promise<CartResponse>;
};
const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<ShopCart | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const changing = useRef(false);
  const sequence = useRef(0);

  const refresh = useCallback(async () => {
    if (changing.current) return;
    const current = ++sequence.current;
    try {
      const response = await fetch("/api/shop/cart", { cache: "no-store" });
      const data: CartResponse = await response.json();
      if (!response.ok) throw new Error(data.error || "Your cart could not be loaded.");
      if (current !== sequence.current) return;
      setCart(data.cart); setEnabled(data.enabled); setError("");
    } catch {
      if (current === sequence.current) setError("Your cart could not be loaded. Please try again.");
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onReturn = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("pageshow", onReturn);
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      window.removeEventListener("pageshow", onReturn);
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [refresh]);

  const change = useCallback(async (method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) => {
    if (changing.current) throw new Error("Please wait for your cart to finish updating.");
    changing.current = true; ++sequence.current; setBusy(true); setError("");
    try {
      const response = await fetch("/api/shop/cart", {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data: CartResponse = await response.json();
      if (!response.ok) throw new Error(data.error || "Your cart could not be updated.");
      setCart(data.cart); setEnabled(data.enabled);
      return data;
    } finally {
      changing.current = false; setBusy(false); setLoading(false);
    }
  }, []);

  return <CartContext.Provider value={{ cart, enabled, loading, busy, error, refresh, change }}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("CartProvider is missing.");
  return context;
}
