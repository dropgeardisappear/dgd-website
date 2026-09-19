"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Header } from "./Finder";
import { isShopProfilePath } from "@/lib/shop-finder/login-return";
import { Inbox } from "./Messages";
type Shop = {id:string;name:string;logo:string;city:string;state:string;status:string;availability?:string};
export default function Dashboard() {
  const [shops,setShops]=useState<Shop[]>([]);
  const [loading,setLoading]=useState(true);
  const [signedIn,setSignedIn]=useState(false);
  const [error,setError]=useState("");
  const [tab,setTab]=useState("shops");
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    async function load(){
      setLoading(true);setError("");
      try{
        const {data:{session}}=await supabase.auth.getSession();
        if(controller.signal.aborted)return;
        setSignedIn(!!session);setShops([]);
        if(!session)return;
        try {
          const saved = sessionStorage.getItem("dgd-shop-login-return");
          sessionStorage.removeItem("dgd-shop-login-return");
          const target = saved ? JSON.parse(saved) : null;
          if(target && target.expires > Date.now() && isShopProfilePath(target.path)) {
            window.location.replace(target.path);
            return;
          }
        } catch { /* Normal dashboard access still works without session storage. */ }

        const r=await fetch("/api/shop-finder/shops",{signal:controller.signal,headers:{Authorization:`Bearer ${session.access_token}`}});
        const data=await r.json();if(!r.ok)throw Error(data.error||"Could not load your shops.");
        if(!controller.signal.aborted)setShops(data.shops);
      }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Could not load your shops.");}
      finally{if(!controller.signal.aborted)setLoading(false);}
    }
    void load();
    return ()=>controller.abort();
  },[refresh]);
  useEffect(()=>{const {data:{subscription}}=supabase.auth.onAuthStateChange((event)=>{if(event!=="INITIAL_SESSION")setRefresh(n=>n+1);});return ()=>subscription.unsubscribe();},[]);
  return <><Header/><main className="dashboard-shell">
    <div className="dashboard-heading"><div><span className="eyebrow">DGD FOR SHOP OWNERS</span><h1>Your shop. Your next customer.</h1><p>Keep your listing fresh, manage your shops, and follow up on inquiries.</p></div>{signedIn&&<a className="primary" href="/shop-finder/list-your-shop">+ Add a shop</a>}</div>
    {loading?<section className="form-card" role="status">Loading your workspace…</section>:!signedIn?<section className="dashboard-welcome form-card"><h2>Your business, all in one place.</h2><p>Sign in with your DGD account to manage your listings, photos, and customer requests.</p><a className="primary" href="/login?next=%2Fshop-finder%2Fdashboard">Sign in to your dashboard →</a><p className="small">Free founding listings. No credit card required.</p></section>:<>
      <div className="dashboard-stats"><div><strong>{shops.length}</strong><span>Your shops</span></div><div><strong>{shops.filter(s=>s.status==='approved').length}</strong><span>Live listings</span></div><div><strong>{shops.filter(s=>s.status==='pending').length}</strong><span>Awaiting review</span></div><div><strong>Free</strong><span>Your current plan</span></div></div>
      <div className="dashboard-tabs" role="group" aria-label="Dashboard views"><button className={tab==='shops'?'active':''} aria-pressed={tab==='shops'} onClick={()=>setTab('shops')}>My shops</button><button className={tab==='inbox'?'active':''} aria-pressed={tab==='inbox'} onClick={()=>setTab('inbox')}>Requests & messages</button></div>
      {error?<div className="notice" role="alert">{error} <button className="secondary" onClick={()=>setRefresh(n=>n+1)}>Try again</button></div>:tab==='inbox'?<Inbox/>:shops.length?<div className="dashboard-list">{shops.map(s=><article className="dashboard-shop" key={s.id}><img src={s.logo} alt=""/><div><span className={`listing-status status-${s.status}`}>{s.status==='approved'?'Live':s.status==='pending'?'Awaiting review':'Changes needed'}</span><h2>{s.name}</h2><p>{s.city}, {s.state}</p><p className="small">{s.availability||'Accepting inquiries'}</p></div><div className="dashboard-actions"><a className="secondary" href={`/shop-finder/list-your-shop?edit=${s.id}`}>Edit shop</a>{s.status==='approved'&&<a className="text-link" href={`/shop-finder/shops/${s.id}`}>View profile ↗</a>}</div></article>)}</div>:<section className="dashboard-welcome form-card"><h2>Let’s put your shop on the map.</h2><p>Add your logo, services, and location. DGD will review your listing before it appears in search.</p><a className="primary" href="/shop-finder/list-your-shop">Create your first listing →</a></section>}
      <p className="small dashboard-footnote">Edits go through DGD review again. Quote requests are inquiries, not confirmed appointments.</p>
    </>}
  </main></>;
}
