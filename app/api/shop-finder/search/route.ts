import {reserveAI} from "@/lib/shop-finder/limits";
import { openNow } from "@/lib/shop-finder/hours";
import { interpretRequest } from "@/lib/shop-finder/matching";
import { shopDatabase } from "@/lib/shop/supabase-server";
import { geocode } from "@/lib/shop-finder/geocode";
import { categories, vehicles } from "@/lib/shop-finder/catalog";
const aliases: Record<string, string[]> = {
  lift: ["Lift kits"],
  lower: ["Lowering kits"],
  alignment: ["Wheel alignment"],
  dent: ["Dent removal", "Paintless dent repair"],
  brake: ["Brakes"],
  tire: ["Tire installation", "Tire repair"],
  exhaust: ["Exhaust"],
  paint: ["Full paint", "Custom paint"],
  wrap: ["Vinyl wraps"],
  oil: ["Oil changes"],
  tint: ["Window tint"],
  detail: ["Interior detailing"],
  suspension: ["Suspension & Steering"],
  engine: ["Engine repair", "Engine builds"],
  transmission: ["Transmission"],
  ac: ["AC repair"],
  mechanic: ["Mechanic & Repair"],
};
function distance(a: any, b: any) {
  const rad = Math.PI / 180;
  const x =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) *
      Math.cos(b.lat * rad) *
      Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
export async function POST(req: Request) {
  try {
    const d: any = await req.json();
    if (
      !vehicles.includes(d.vehicle) ||
      typeof d.need !== "string" ||
      d.need.length > 3000
    )
      return Response.json(
        {
          error:
            "Choose a vehicle and keep the work description under 3,000 characters.",
        },
        { status: 400 },
      );
    if (
      ["location", "county", "state", "year", "make", "model", "tag"].some(
        (k) => d[k] != null && (typeof d[k] !== "string" || d[k].length > 150),
      )
    )
      return Response.json(
        { error: "Keep location and vehicle details under 150 characters." },
        { status: 400 },
      );
    let coords = d.coords;
    if (
      coords &&
      (!Number.isFinite(coords.lat) ||
        !Number.isFinite(coords.lon) ||
        Math.abs(coords.lat) > 90 ||
        Math.abs(coords.lon) > 180)
    )
      return Response.json(
        { error: "Please enter a valid location." },
        { status: 400 },
      );
    if (!coords && !d.location?.trim())
      return Response.json(
        { error: "Enter your city or ZIP code." },
        { status: 400 },
      );
    const interpretation = d.need.trim() && await reserveAI(req)
      ? await interpretRequest({need:d.need,vehicle:d.vehicle,year:d.year,make:d.make,model:d.model})
      : { tags: [], question: "", mode: "tags" };
    const tags = new Set<string>(d.tag ? [d.tag] : interpretation.tags);
    const words = d.need.toLowerCase();
    for (const [word, ts] of Object.entries(aliases)) {
      if (new RegExp(`\\b${word}\\w*\\b`).test(words))
        ts.forEach((t) => tags.add(t));
    }
    for (const tag of Object.values(categories).flat())
      if (words.includes(tag.toLowerCase())) tags.add(tag);
    if (!coords) coords = await geocode(`${d.location} ${d.state || ""}`);
    const { data: rows, error } = await shopDatabase()
      .from("directory_shops")
      .select("id,name,data,verified")
      .eq("status", "approved")
      .limit(500);
    if (error) throw error;
    let shops = (rows || [])
      .map((row: any) => ({ id: row.id, name: row.name, ...row.data, verified: row.verified }))
      .filter((s: any) => s.vehicles.includes(d.vehicle));
    if(d.mobileOnly===true)shops=shops.filter((s:any)=>s.mobile);
    if(d.openOnly===true)shops=shops.filter((s:any)=>s.availability!=="Temporarily unavailable"&&openNow(s.schedule,s.timezone));
    const wanted = [...tags];
    if (wanted.length)
      shops = shops.filter((s: any) =>
        wanted.some(
          (t) =>
            s.tags.includes(t) ||
            (categories[t] || []).some((sub) => s.tags.includes(sub)),
        ),
      );
    if (d.county)
      shops = shops.filter(
        (s: any) =>
          s.county.toLowerCase().replace(/ county$/, "") ===
          d.county.toLowerCase().replace(/ county$/, ""),
      );
    if (d.state)
      shops = shops.filter(
        (s: any) => s.state.toLowerCase() === d.state.toLowerCase(),
      );
    if (coords) {
      shops = shops
        .filter((s: any) => s.lat != null && s.lon != null)
        .map((s: any) => ({
          ...s,
          distance: Math.round(distance(coords, s) * 10) / 10,
        }))
        .filter((s: any) => s.distance <= Math.min(250, Number(d.radius) || 25))
        .sort((a: any, b: any) => a.distance - b.distance);
    } else {
      shops = shops.filter(
        (s: any) =>
          s.city.toLowerCase() === d.location.toLowerCase() ||
          s.zip === d.location,
      );
    }
    const safe = shops.map(({ email, lat, lon, ...rest }: any) => ({
      ...rest,
      address: rest.mobile ? "" : rest.address,
    }));
    let message = shops.length
      ? `${shops.length} ${shops.length === 1 ? "shop" : "shops"} found${wanted.length ? " for " + wanted.join(", ") : ""}. Confirm your exact vehicle and project with the shop.`
      : "No matching shops yet. Try a wider distance or another service. Own a shop? Join the founding directory.";
    if (d.need.trim() && !wanted.length)
      message =
        "We could not identify a service from that description. Choose a service tag to narrow these results. " +
        message;
    if (!coords)
      message +=
        " Distance lookup is unavailable; results match your city or ZIP code.";
    if (interpretation.question)
      message = interpretation.question + " " + message;
    return Response.json({
      shops: safe,
      message,
      tags: wanted,
      matching: interpretation.mode,
    });
  } catch {
    return Response.json(
      { error: "Shop search is temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
}
