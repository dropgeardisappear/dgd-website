import "server-only";
import { createClient } from "@supabase/supabase-js";

export class ShopUnavailableError extends Error {}
export class CartUpdateError extends Error {}

export function shopIsConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function shopDatabase(token?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new ShopUnavailableError("The shop is not available yet.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });
}

export function paymentDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new ShopUnavailableError("Checkout is not available yet.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

export async function requireShopOwner(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) return null;
  const db = shopDatabase(token);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  const access = await db.rpc("shop_is_admin");
  return !access.error && access.data === true ? db : null;
}
