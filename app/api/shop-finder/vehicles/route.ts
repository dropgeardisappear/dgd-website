const types: Record<string, string> = { Car: "car", Truck: "truck", Motorcycle: "motorcycle" };
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const type = types[q.get("vehicle") || ""];
  const make = q.get("make"), year = q.get("year");
  if (!type || (make && !/^[1-9]\d{0,6}$/.test(make)) ||
      (make && (!year || !/^\d{4}$/.test(year) || +year < 1996 || +year > new Date().getFullYear() + 1))) {
    return Response.json({ error: "Enter vehicle details manually for this selection." }, { status: 400 });
  }
  const path = make
    ? `GetModelsForMakeIdYear/makeId/${make}/modelyear/${year}/vehicletype/${type}`
    : `GetMakesForVehicleType/${type}`;
  try {
    const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/${path}?format=json`, {
      next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw Error("Lookup unavailable");
    const data = await response.json();
    if (!Array.isArray(data.Results)) throw Error("Invalid lookup");
    const options = make
      ? [...new Set<string>(data.Results.map((r: any) => r.Model_Name).filter((n: unknown) => typeof n === "string"))].sort().map(name => ({ name }))
      : data.Results.filter((r: any) => Number.isInteger(r.MakeId) && typeof r.MakeName === "string")
          .map((r: any) => ({ id: r.MakeId, name: r.MakeName })).sort((a: any, b: any) => a.name.localeCompare(b.name));
    return Response.json({ options });
  } catch {
    return Response.json({ error: "Suggestions are unavailable. You can still type your vehicle details." }, { status: 503 });
  }
}
