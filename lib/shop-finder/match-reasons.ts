import { categories } from "./catalog";

/** Explain only listing facts used by the search; never infer make/model expertise. */
export function matchReasons(shop: {
  tags: string[]; vehicles: string[]; distance?: number; mobile?: boolean;
}, requested: string[], vehicle: string) {
  const services = shop.tags.filter(tag => requested.some(wanted =>
    tag === wanted || (categories[wanted] || []).includes(tag),
  ));
  const reasons: string[] = [];
  if (services.length) reasons.push(`Listed services: ${[...new Set(services)].join(", ")}`);
  if (shop.vehicles.includes(vehicle)) {
    const label: Record<string, string> = { Car: "cars", Truck: "trucks", Motorcycle: "motorcycles" };
    reasons.push(`Works on ${label[vehicle] || vehicle.toLowerCase()}`);
  }
  if (Number.isFinite(shop.distance)) reasons.push(`About ${shop.distance} miles from your search location`);
  if (shop.mobile) reasons.push("Offers mobile service — confirm their service area");
  return reasons;
}
