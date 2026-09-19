import "server-only";
import { cache } from "react";
import type { Product } from "./types";
import type { ShopProductRow, ShopSettings } from "./database-types";
import { shopDatabase, ShopUnavailableError } from "./supabase-server";
export { shopIsConfigured } from "./supabase-server";

export const getShopSettings = cache(async (): Promise<ShopSettings> => {
  const { data, error } = await shopDatabase().from("shop_settings").select("*").eq("id", 1).single();
  if (error) throw new ShopUnavailableError("The shop is temporarily unavailable.");
  return data as ShopSettings;
});

export function toProduct(row: ShopProductRow): Product {
  const price = { amount: ((row.price_cents || 0) / 100).toFixed(2), currencyCode: "USD" };
  const images = Array.isArray(row.images) ? row.images.filter(image => image && typeof image.url === "string") : [];
  const available = row.status === "active" && row.price_cents !== null && row.stock_quantity - row.reserved_quantity > 0;
  return {
    id: row.id, handle: row.handle, title: row.title, description: row.description, productType: row.category,
    availableForSale: available, requiresSellingPlan: false, featuredImage: images[0] || null,
    images: { nodes: images }, priceRange: { minVariantPrice: price, maxVariantPrice: price },
    options: [], variants: { nodes: [{ id: row.id, title: "Default Title", availableForSale: available, price, compareAtPrice: null, selectedOptions: [], image: images[0] || null }], pageInfo: { hasNextPage: false, endCursor: null } },
    metafields: ["dimensions", "material", "finish", "application_care"].map(key => ({ key, value: String(row[key as keyof ShopProductRow] || "") })),
    seo: { title: row.title, description: row.description.slice(0, 160) },
  };
}

export async function getProducts(after?: string) {
  const offset = after && /^\d{1,6}$/.test(after) ? Number(after) : 0;
  const { data, error } = await shopDatabase().from("shop_products").select("*").eq("status", "active")
    .order("created_at", { ascending: false }).order("id").range(offset, offset + 24);
  if (error) throw new ShopUnavailableError("The shop is temporarily unavailable.");
  const rows = data as ShopProductRow[];
  return { nodes: rows.slice(0, 24).map(toProduct), pageInfo: { hasNextPage: rows.length > 24, endCursor: rows.length > 24 ? String(offset + 24) : null } };
}

export const getProduct = cache(async (handle: string) => {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(handle) || handle.length > 120) return null;
  const { data, error } = await shopDatabase().from("shop_products").select("*").eq("handle", handle).eq("status", "active").maybeSingle();
  if (error) throw new ShopUnavailableError("The product could not be loaded.");
  return data ? toProduct(data as ShopProductRow) : null;
});

export async function getProductRows(ids: string[]) {
  if (!ids.length) return [];
  const { data, error } = await shopDatabase().from("shop_products").select("*").eq("status", "active").in("id", ids);
  if (error) throw new ShopUnavailableError("Your items could not be loaded.");
  return data as ShopProductRow[];
}
