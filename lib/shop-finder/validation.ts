import { categories, vehicles } from "./catalog";
export function validateShop(d: any) {
  if (!d || typeof d !== "object") throw Error("Enter your shop details.");
  for (const k of ["name", "email", "description", "city", "state"])
    if (typeof d[k] !== "string" || !d[k].trim() || d[k].length > 1200)
      throw Error(
        "Complete your shop name, email, description, city, and state.",
      );
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))
    throw Error("Enter a valid private email.");
  if (!d.mobile && !d.address?.trim())
    throw Error("Enter a street address or choose mobile service.");
  if (
    !Array.isArray(d.vehicles) ||
    !d.vehicles.length ||
    d.vehicles.some((v: string) => !vehicles.includes(v))
  )
    throw Error("Select your vehicle types.");
  const allowed = Object.values(categories).flat();
  if (
    !Array.isArray(d.tags) ||
    !d.tags.length ||
    d.tags.some((t: string) => !allowed.includes(t))
  )
    throw Error("Select the services your shop offers.");
  if (!["website", "instagram", "facebook"].some((k) => d[k]))
    throw Error("Add a website, Instagram, or Facebook link.");
  for (const k of ["website", "instagram", "facebook"]) {
    if (!d[k]) continue;
    let u: URL;
    try {
      u = new URL(d[k]);
    } catch {
      throw Error("Enter full links starting with https://.");
    }
    if (!["http:", "https:"].includes(u.protocol) || u.username || u.password)
      throw Error("Enter a valid website or social link.");
    if (
      k !== "website" &&
      u.hostname !== `${k}.com` &&
      !u.hostname.endsWith(`.${k}.com`)
    )
      throw Error(`Enter a valid ${k} link.`);
  }
  const data: any = {};
  for (const k of [
    "description",
    "city",
    "county",
    "state",
    "zip",
    "phone",
    "website",
    "instagram",
    "facebook",
    "hours",
  ])
    data[k] = String(d[k] || "")
      .trim()
      .slice(0, 1200);
  data.address = d.mobile
    ? ""
    : String(d.address || "")
        .trim()
        .slice(0, 300);
  data.mobile = !!d.mobile;
  data.vehicles = [...new Set(d.vehicles)];
  data.tags = [...new Set(d.tags)];
  return data;
}
export function distance(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
) {
  const rad = Math.PI / 180;
  const x = Math.min(
    1,
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
      Math.cos(a.lat * rad) *
        Math.cos(b.lat * rad) *
        Math.sin(((b.lon - a.lon) * rad) / 2) ** 2,
  );
  return 3958.8 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
