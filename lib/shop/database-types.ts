import type { ProductImage } from "./types";

export type ShopProductRow = {
  id: string; handle: string; title: string; description: string; category: string;
  status: "draft" | "active" | "archived"; price_cents: number | null;
  stock_quantity: number; reserved_quantity: number; sku: string;
  dimensions: string; material: string; finish: string; application_care: string;
  weight_grams: number | null; ships_as_letter: boolean; images: ProductImage[]; created_at: string; updated_at: string;
};
export type ShopSettings = {
  id: number; store_open: boolean; support_email: string;
  shipping_flat_cents: number | null; free_shipping_over_cents: number | null;
  shipping_mode: "flat" | "stamped_letters"; letter_rate_cents: number; letter_max_items: number;
  shipping_countries: string[]; tax_mode: "unconfigured" | "stripe_tax" | "no_tax";
  shipping_policy: string; refund_policy: string; updated_at: string;
};
export type OrderItem = {
  id: string; order_id: string; product_id: string; title: string; sku: string;
  unit_price_cents: number; quantity: number;
};
export type ShopOrder = {
  id: string; order_number: number; cart_key: string; stripe_session_id: string;
  stripe_payment_intent: string | null; livemode: boolean;
  status: "pending" | "paid" | "expired" | "failed"; fulfillment_status: "unfulfilled" | "shipped";
  subtotal_cents: number; shipping_cents: number; tax_cents: number; total_cents: number | null;
  shipping_details: ShippingQuote | null;
  refunded_cents: number; currency: "usd"; customer_email: string | null; customer_name: string | null;
  shipping_address: Record<string, string | null> | null; tracking_number: string; carrier: string;
  created_at: string; paid_at: string | null; shipped_at: string | null; shop_order_items: OrderItem[];
};

export type ShippingQuote = {
  shipping_cents: number; subtotal_cents: number; method: "flat" | "stamped_letters";
  envelope_count: number;
  packing: { product_id: string; title: string; quantity: number; envelopes: number; items_per_envelope: number }[];
};

export const usd = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
