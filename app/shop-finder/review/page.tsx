"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {Inbox} from "@/components/shop-finder/Messages";
import { Header } from "@/components/shop-finder/Finder";
export default function Review() {
  const [shops, S] = useState<any[]>([]),
    [message, M] = useState("Loading review queue…");
  const [filter, setFilter] = useState("all");
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  async function headers() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    setSignedIn(Boolean(session));
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || ""}`,
    };
  }
  async function load() {
    try {
      const r = await fetch("/api/shop-finder/review", {
        headers: await headers(),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      S(d.shops);
      M(d.shops.length ? "" : "No shop listings yet.");
    } catch (e: any) {
      M(e.message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function review(id: string, status: string, verified = false) {
    const r = await fetch("/api/shop-finder/review", {
      method: "POST",
      headers: await headers(),
      body: JSON.stringify({ id, status, verified }),
    });
    if (!r.ok) {
      M((await r.json()).error);
      return;
    }
    await load();
  }
  return (
    <>
      <Header />
      <main className="form-shell">
        <a href="/admin" className="text-link">← Back to admin</a>
        <h1>Shop Finder listings</h1>
        <p>View all submitted shops and review new listings before they appear in the finder.</p>
        {signedIn === false ? <div className="notice">
          <p>Sign in with your DGD administrator account to review shop listings.</p>
          <a className="primary" style={{display:"inline-flex",marginTop:16}} href="/login?next=%2Fshop-finder%2Freview">Sign in to review shops →</a>
        </div> : <><p role="status">{message}</p><Inbox/></>}

        <label className="field">Listing status
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All listings ({shops.length})</option>
            {["pending", "approved", "rejected"].map((status) => <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)} ({shops.filter((shop) => shop.status === status).length})</option>)}
          </select>
        </label>
        {shops.length > 0 && !shops.some((shop) => filter === "all" || shop.status === filter) && <p>No {filter} listings.</p>}
        {shops.filter((shop) => filter === "all" || shop.status === filter).map((s) => (
          <article className="shop-card" key={s.id}>
            <div>
              <h2>{s.name}</h2>
              <p className="chip">{s.status.charAt(0).toUpperCase() + s.status.slice(1)}{s.verified ? " · Verified" : ""}</p>
              {s.status === "approved" && <a className="text-link" href={`/shop-finder/shops/${s.id}`}>View public listing →</a>}
              <p>
                {s.city}, {s.state}
              </p>
              <p>{s.description}</p>
              <p>{(s.tags || []).join(" · ")}</p>
              <div className="links">
                {["website", "instagram", "facebook"].map(
                  (k) =>
                    /^https?:\/\//i.test(s[k] || "") && (
                      <a key={k} href={s[k]} target="_blank" rel="noreferrer">
                        {k}
                      </a>
                    ),
                )}
              </div>
              {s.status === "pending" && <div className="form-actions">
                <button
                  className="secondary"
                  onClick={() => review(s.id, "rejected")}
                >
                  Reject
                </button>
                <button
                  className="primary"
                  onClick={() => review(s.id, "approved")}
                >
                  Approve listing
                </button>
              <button className="secondary" onClick={()=>review(s.id,"approved",true)}>Approve & verify business details</button></div>}
            </div>
          </article>
        ))}
      </main>
    </>
  );
}
