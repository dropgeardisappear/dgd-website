import { userDatabase, failure } from "@/lib/shop-finder/server";
async function admin(req: Request) {
  const a = await userDatabase(req);
  if (!a) return null;
  const r = await a.db.rpc("shop_is_admin");
  return r.data === true ? a : null;
}
export async function GET(req: Request) {
  try {
    const a = await admin(req);
    if (!a) return failure("DGD administrator access required.", 403);
    const r = await a.db
      .from("directory_shops")
      .select("id,name,data,status")
      .eq("status", "pending")
      .order("created_at");
    if (r.error) throw r.error;
    return Response.json(
      {
        shops: r.data.map((x) => ({
          ...x.data,
          id: x.id,
          name: x.name,
          status: x.status,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return failure("Review queue is unavailable.", 503);
  }
}
export async function POST(req: Request) {
  try {
    const a = await admin(req);
    if (!a) return failure("DGD administrator access required.", 403);
    const { id, status } = await req.json();
    if (!["approved", "rejected"].includes(status))
      return failure("Choose approve or reject.");
    const r = await a.db
      .from("directory_shops")
      .update({ status })
      .eq("id", id)
      .eq("status", "pending")
      .select("id")
      .single();
    if (r.error)
      return failure("This listing changed. Reload the review queue.");
    return Response.json({ id: r.data.id, status });
  } catch {
    return failure("Could not update this listing.", 503);
  }
}
