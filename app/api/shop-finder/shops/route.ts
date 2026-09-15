import { userDatabase, failure } from "@/lib/shop-finder/server";
import { validateShop } from "@/lib/shop-finder/validation";
import { geocode } from "@/lib/shop-finder/geocode";
export const runtime = "nodejs";
export async function GET(req: Request) {
  try {
    const auth = await userDatabase(req);
    if (!auth) return failure("Sign in to DGD to manage your shops.", 401);
    const { data, error } = await auth.db
      .from("directory_shops")
      .select("id,name,data,status,plan,directory_contacts(email)")
      .eq("owner_id", auth.user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return Response.json(
      {
        shops: data.map((s) => ({
          ...s.data,
          id: s.id,
          name: s.name,
          status: s.status,
          plan: s.plan,
          email: (s.directory_contacts as any)?.email || "",
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return failure("Your shop listings are temporarily unavailable.", 503);
  }
}
export async function POST(req: Request) {
  let uploaded = "";
  let auth: Awaited<ReturnType<typeof userDatabase>> = null;
  try {
    auth = await userDatabase(req);
    if (!auth) return failure("Sign in to DGD to submit your shop.", 401);
    if (Number(req.headers.get("content-length")) > 3500000)
      return failure("Use a logo under 3 MB.", 413);
    const f = await req.formData();
    const input = JSON.parse(String(f.get("data") || "{}"));
    const data = validateShop(input);
    const id = input.id || crypto.randomUUID();
    if (!/^[0-9a-f-]{36}$/i.test(id)) return failure("Invalid listing.");
    const old = await auth.db
      .from("directory_shops")
      .select("owner_id,data")
      .eq("id", id)
      .maybeSingle();
    if (old.error) throw old.error;
    if (input.id && old.data?.owner_id !== auth.user.id)
      return failure("You cannot edit this listing.", 403);
    const file = f.get("logo");
    if (file instanceof File && file.size) {
      if (
        file.size > 3145728 ||
        !["image/png", "image/jpeg", "image/webp"].includes(file.type)
      )
        return failure("Use a PNG, JPG, or WebP logo under 3 MB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const valid =
        file.type === "image/png"
          ? bytes[0] === 137 && bytes[1] === 80
          : file.type === "image/jpeg"
            ? bytes[0] === 255 && bytes[1] === 216
            : bytes[0] === 82 && bytes[8] === 87;
      if (!valid) return failure("Upload a supported image file.");
      const ext = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp",
      }[file.type];
      uploaded = `${auth.user.id}/${id}/${crypto.randomUUID()}.${ext}`;
      const upload = await auth.db.storage
        .from("directory-logos")
        .upload(uploaded, bytes, { contentType: file.type, upsert: false });
      if (upload.error) throw upload.error;
      data.logo = auth.db.storage
        .from("directory-logos")
        .getPublicUrl(uploaded).data.publicUrl;
    } else {
      data.logo = old.data?.data?.logo;
      if (!data.logo) return failure("Upload your shop logo.");
    }
    const coords = await geocode(
      `${data.address} ${data.city} ${data.state} ${data.zip}`,
    );
    data.lat = coords?.lat ?? null;
    data.lon = coords?.lon ?? null;
    const saved = await auth.db.rpc("save_directory_shop", {
      shop_id: id,
      shop_name: input.name.trim(),
      shop_data: data,
      contact_email: input.email.trim(),
    });
    if (saved.error) throw saved.error;
    return Response.json({
      id,
      message:
        "Your shop is saved and awaiting DGD review. It will appear in search once approved.",
    });
  } catch (e) {
    if (uploaded && auth)
      await auth.db.storage.from("directory-logos").remove([uploaded]);
    return failure(
      e instanceof Error
        ? e.message
        : "Your shop could not be saved. Please try again.",
      400,
    );
  }
}
