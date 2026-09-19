import "server-only";
import { shopDatabase } from "@/lib/shop/supabase-server";
export async function userDatabase(request: Request) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) return null;
  const db = shopDatabase(token);
  const { data, error } = await db.auth.getUser(token);
  return error || !data.user ? null : { db, user: data.user };
}
export function failure(error: string, status = 400) {
  return Response.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
