import "server-only";
export async function geocode(location: string) {
  try {
    const r = await fetch(
      "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=" +
        encodeURIComponent(location),
      {
        headers: {
          "User-Agent": "DGD-Shop-Finder (https://www.dropgeardisappear.us)",
        },
        signal: AbortSignal.timeout(6000),
        next: { revalidate: 86400 },
      },
    );
    if (!r.ok) return null;
    const x = await r.json();
    return x[0] ? { lat: Number(x[0].lat), lon: Number(x[0].lon) } : null;
  } catch {
    return null;
  }
}
