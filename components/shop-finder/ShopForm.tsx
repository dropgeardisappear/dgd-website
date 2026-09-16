"use client";
import { useEffect, useState } from "react";
import { weekdays } from "@/lib/shop-finder/hours";
import { Inbox } from "./Messages";
import { Header } from "./Finder";
import { supabase } from "@/lib/supabase";
function Checkbox({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
    />
  );
}

import { categories, vehicles } from "@/lib/shop-finder/catalog";
import { ArrowRight, CheckCircle2, Upload } from "lucide-react";
const initial = {
  name: "",
  email: "",
  description: "",
  website: "",
  instagram: "",
  facebook: "",
  phone: "",
  address: "",
  city: "",
  county: "",
  state: "",
  zip: "",
  hours: "",
  availability: "Accepting inquiries",
  timezone: "America/New_York",
  schedule: Array.from({length:7},()=>({open:"",close:""})),
  mobile: false,
  vehicles: [] as string[],
  tags: [] as string[],
};
export default function ShopForm({ dashboard = false }: { dashboard?: boolean }) {
  const [signedIn, SI] = useState(false);
  const signInHref = "/login?next=%2Fshop-finder%2Flist-your-shop";
  useEffect(() => {
    supabase.auth.getUser().then(({ data }: any) => SI(!!data.user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: any, session: any) =>
      SI(!!session?.user),
    );
    return () => subscription.unsubscribe();
  }, []);
  async function authHeaders() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${session?.access_token || ""}` };
  }
  const [photos, PH] = useState<File[]>([]);
  const [d, D] = useState<any>(initial),
    [step, S] = useState(0),
    [logo, L] = useState<File | null>(null),
    [logoUrl, LU] = useState(""),
    [error, E] = useState(""),
    [busy, B] = useState(false),
    [saved, SA] = useState(""),
    [mine, MI] = useState<any[]>([]);
  useEffect(() => {
    if (signedIn)
      authHeaders()
        .then((headers) => fetch("/api/shop-finder/shops", { headers }))
        .then((r) => r.json())
        .then((x: any) => {
          if (x.shops) {MI(x.shops);
            const id=new URLSearchParams(window.location.search).get("edit");
            const selected=x.shops.find((shop:any)=>shop.id===id);
            if(selected&&!saved){D({...initial,...selected});L(null);PH([]);LU("");}
          }
        })
        .catch(() => {});
  }, [signedIn, saved]);
  useEffect(() => {
    if (!logo) return;
    const u = URL.createObjectURL(logo);
    LU(u);
    return () => URL.revokeObjectURL(u);
  }, [logo]);
  function set(k: string, v: any) {
    D({ ...d, [k]: v });
  }
  function toggle(k: string, v: string) {
    set(
      k,
      d[k].includes(v) ? d[k].filter((x: string) => x !== v) : [...d[k], v],
    );
  }
  function field(
    k: string,
    label: string,
    placeholder = "",
    required = false,
    type = "text",
  ) {
    return (
      <label className="field">
        {label}
        <input
          type={type}
          required={required}
          maxLength={1200}
          value={d[k]}
          onChange={(e) => set(k, e.target.value)}
          placeholder={placeholder}
        />
      </label>
    );
  }
  async function submit(e: any) {
    e.preventDefault();
    E("");
    if (step === 0) {
      if (!d.website && !d.instagram && !d.facebook) {
        E("Add at least one website, Instagram, or Facebook link.");
        return;
      }
      if (!logo && !d.id) {
        E("Please upload your shop logo.");
        return;
      }
      S(1);
      return;
    }
    if (step === 1) {
      if (!d.vehicles.length) {
        E("Choose at least one vehicle type.");
        return;
      }
      S(2);
      return;
    }
    if (!d.tags.length) {
      E("Choose at least one service.");
      return;
    }
    B(true);
    try {
      const f = new FormData();
      f.append("data", JSON.stringify(d));
      if (logo) f.append("logo", logo);
      photos.forEach(file=>f.append("photos",file));
      const r = await fetch("/api/shop-finder/shops", {
        method: "POST",
        headers: await authHeaders(),
        body: f,
      });
      const result: any = await r.json();
      if (!r.ok) throw Error(result.error);
      SA(result.message);
    } catch (e: any) {
      E(e.message || "Could not save your shop. Please try again.");
    } finally {
      B(false);
    }
  }
  return (
    <>
      <Header />
      <main className="form-shell">
        {dashboard && signedIn && <Inbox/>}
        <span className="eyebrow">JOIN THE DGD SHOP DIRECTORY</span>
        <h1>{dashboard ? "Your shop dashboard." : "Put your shop on the map."}</h1>
        <p>
          Connect with people who need your skills. Founding listings are
          free—no card required.
        </p>
        {!signedIn && (
          <div className="notice">
            Sign in to save your shop and manage it later.{" "}
            <a href={signInHref} target="_top" className="text-link">
              Sign in to DGD →
            </a>
          </div>
        )}
        {saved ? (
          <section className="form-card">
            <CheckCircle2 size={42} color="#ff6900" />
            <h2 style={{ marginTop: 20 }}>You’re in the garage.</h2>
            <p style={{ margin: "15px 0" }}>{saved}</p>
            <a href="/shop-finder/dashboard" className="primary">
              Go to my dashboard
            </a>
          </section>
        ) : (
          <>
            <div className="steps">
              {["Shop details", "Location & vehicles", "Services & review"].map(
                (s, i) => (
                  <span key={s} className={i === step ? "current" : ""}>
                    {i + 1}. {s}
                  </span>
                ),
              )}
            </div>
            <progress value={step + 1} max={3} aria-label="Signup progress" />
            <form className="form-card" onSubmit={submit}>
              {step === 0 && (
                <>
                  <h2>Your shop, at a glance.</h2>
                  <p className="form-help">
                    Start with the basics. Add at least one link so customers
                    can see your work.
                  </p>
                  {field("name", "Shop name", "Your business name", true)}
                  <label className="field">
                    Shop logo{" "}
                    <span className="upload">
                      <Upload size={22} />
                      {logoUrl ? (
                        <img src={logoUrl} alt="Your logo preview" />
                      ) : d.id ? (
                        <img src={d.logo} alt="Current shop logo" />
                      ) : (
                        <span>PNG, JPG, or WebP • Maximum 3 MB</span>
                      )}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => L(e.target.files?.[0] || null)}
                      />
                    </span>
                  </label>
                  <label className="field">Photos of your work (up to 4, each under 500 KB)<input type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={e=>{const files=Array.from(e.target.files||[]);if(files.length>4||files.some(f=>f.size>500000)){E("Choose up to 4 photos under 500 KB each.");PH([]);}else{PH(files);E("");}}}/></label><p className="small">New photos replace the existing gallery when saved.</p>
                  {field(
                    "email",
                    "Private contact email",
                    "you@yourshop.com",
                    true,
                    "email",
                  )}
                  <label className="field">
                    About your shop
                    <textarea
                      required
                      value={d.description}
                      maxLength={1200}
                      onChange={(e) => set("description", e.target.value)}
                      placeholder="Tell customers what you do best."
                    />
                  </label>
                  {field(
                    "website",
                    "Website",
                    "https://yourshop.com",
                    false,
                    "url",
                  )}
                  {field(
                    "instagram",
                    "Instagram",
                    "https://instagram.com/yourshop",
                    false,
                    "url",
                  )}
                  {field(
                    "facebook",
                    "Facebook",
                    "https://facebook.com/yourshop",
                    false,
                    "url",
                  )}
                  {field(
                    "phone",
                    "Public phone number (optional)",
                    "Customers can call you directly",
                    false,
                    "tel",
                  )}
                </>
              )}
              {step === 1 && (
                <>
                  <h2>Where do you work?</h2>
                  <p className="form-help">
                    Your location helps customers find you. Mobile shops display
                    a service area.
                  </p>
                  <label className="check-label">
                    <Checkbox
                      checked={d.mobile}
                      onCheckedChange={(v) => set("mobile", v === true)}
                    />{" "}
                    I offer mobile service—hide my street address
                  </label>
                  {!d.mobile &&
                    field("address", "Shop address", "Street address", true)}
                  <div className="grid3">
                    {field("city", "City", "City", true)}
                    {field("state", "State", "e.g. FL", true)}
                    {field("zip", "ZIP code", "ZIP code")}
                  </div>
                  {field("county", "County", "e.g. Orange")}
                  <label className="field">Availability<select value={d.availability||"Accepting inquiries"} onChange={e=>set("availability",e.target.value)}>{["Accepting inquiries","Booking ahead","Temporarily unavailable"].map(v=><option key={v}>{v}</option>)}</select></label><label className="field">Time zone<select value={d.timezone||"America/New_York"} onChange={e=>set("timezone",e.target.value)}>{["America/New_York","America/Chicago","America/Denver","America/Phoenix","America/Los_Angeles","America/Anchorage","Pacific/Honolulu"].map(v=><option key={v}>{v}</option>)}</select></label><h3>Weekly hours</h3><p className="small">Leave both times blank for closed days. These hours power the “Open now” filter.</p>{weekdays.map((day,i)=><div className="grid3" key={day}><span>{day}</span>{["open","close"].map(k=><label className="field" key={k}>{k}<input type="time" value={d.schedule?.[i]?.[k]||""} onChange={e=>{const a=Array.from({length:7},(_,j)=>({...d.schedule?.[j]}));a[i][k]=e.target.value;set("schedule",a);}}/></label>)}</div>)}
                  {field(
                    "hours",
                    "Business hours (optional)",
                    "Mon–Fri, 9am–6pm",
                  )}
                  <h2>Vehicles you service</h2>
                  <p className="form-help">Select all that apply.</p>
                  {vehicles.map((v) => (
                    <label key={v} className="check-label">
                      <Checkbox
                        checked={d.vehicles.includes(v)}
                        onCheckedChange={() => toggle("vehicles", v)}
                      />
                      {v}
                    </label>
                  ))}
                </>
              )}
              {step === 2 && (
                <>
                  <h2>What’s your specialty?</h2>
                  <p className="form-help">
                    Select only services you offer. These tags help customers
                    find the right match.
                  </p>
                  {Object.entries(categories).map(([category, tags]) => (
                    <section className="tag-group" key={category}>
                      <h3>{category}</h3>
                      <div className="tag-options">
                        {tags.map((t) => (
                          <label key={t} className="check-label">
                            <Checkbox
                              checked={d.tags.includes(t)}
                              onCheckedChange={() => toggle("tags", t)}
                            />
                            {t}
                          </label>
                        ))}
                      </div>
                    </section>
                  ))}
                  <div className="review">
                    <span className="eyebrow">LISTING PREVIEW</span>
                    <h2>{d.name}</h2>
                    <p>
                      {d.city}, {d.state} · {d.vehicles.join(", ")}
                    </p>
                    <p>{d.description}</p>
                    <div className="chips">
                      {d.tags.map((t: string) => (
                        <span className="chip" key={t}>
                          {t}
                        </span>
                      ))}
                    </div>
                    <p className="form-help">
                      Free founding listing. Your shop appears after review.
                      Future paid plans will be optional.
                    </p>
                  </div>
                </>
              )}
              {error && (
                <p className="notice" role="alert">
                  {error}
                </p>
              )}
              <div className="form-actions">
                {step > 0 ? (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      S(step - 1);
                      E("");
                    }}
                  >
                    Back
                  </button>
                ) : (
                  <span className="small">Step 1 of 3</span>
                )}
                <button
                  className="primary"
                  disabled={busy || (step === 2 && !signedIn)}
                >
                  {busy
                    ? "Saving…"
                    : step === 2
                      ? "Submit My Shop"
                      : "Continue"}
                  <ArrowRight size={18} />
                </button>
              </div>
            </form>
          </>
        )}
        {mine.length > 0 && (
          <section style={{ marginTop: 35 }}>
            <h2>Manage your shops</h2>
            {mine.map((s) => (
              <article className="shop-card" key={s.id}>
                <div>
                  <h3>{s.name}</h3>
                  <p className="form-help">
                    {s.status === "pending" ? "Awaiting review" : s.status} ·
                    Free plan
                  </p>
                  <button
                    className="secondary"
                    onClick={() => {
                      D(s);
                      SA("");
                      S(0);
                      L(null);
                      LU("");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    Edit listing
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}
        <p className="small">
          Submitting a listing does not verify ownership of a business. All
          submissions are reviewed before appearing in search.
        </p>
      </main>
    </>
  );
}
