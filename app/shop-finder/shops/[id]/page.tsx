import { ContactShop } from "@/components/shop-finder/Messages";
import { notFound } from "next/navigation";
import { shopDatabase } from "@/lib/shop/supabase-server";
import { Header } from "@/components/shop-finder/Finder";
export const dynamic = "force-dynamic";
export default async function ShopProfile({ params }: { params: Promise<{id:string}> }) {
  const {id}=await params;
  if(!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const {data:row,error}=await shopDatabase().from("directory_shops").select("id,name,data,verified").eq("id",id).eq("status","approved").maybeSingle();
  if(error) throw new Error("Shop details are temporarily unavailable.");
  if(!row) notFound();
  const s=row.data;
  return <><Header/><main className="form-shell"><a href="/shop-finder">← Find a shop</a><section className="form-card"><img src={s.logo} alt={`${row.name} logo`} width={120} height={120}/><h1>{row.name}</h1>{row.verified&&<p className="chip">✓ DGD verified business details</p>}<p>{s.city}, {s.state} {s.mobile && "· Mobile service"}</p><p>{s.description}</p><div className="grid3">{(s.photos||[]).map((url:string)=><img key={url} src={url} alt={`${row.name} project photo`} style={{width:"100%",borderRadius:12}}/>)}</div><h2>Services</h2><div className="chips">{s.tags.map((tag:string)=><span className="chip" key={tag}>{tag}</span>)}</div><h2>Vehicles</h2><p>{s.vehicles.join(" · ")}</p><h2>Hours & availability</h2><p style={{whiteSpace:"pre-line"}}>{s.hours || "Contact the shop for current hours."}</p>{s.availability && <p>{s.availability}</p>}<h2>Visit or get in touch</h2>{!s.mobile && <p>{s.address}, {s.city}, {s.state} {s.zip}</p>}<div className="links">{s.phone && <a href={`tel:${s.phone}`}>Call shop</a>}{["website","instagram","facebook"].map(k=>/^https?:\/\//i.test(s[k]||"")?<a key={k} href={s[k]} target="_blank" rel="noreferrer">{k} ↗</a>:null)}</div><p className="small">Listed after DGD review. Confirm availability and vehicle compatibility directly with the shop.</p></section><ContactShop shopId={id}/></main></>;
}
