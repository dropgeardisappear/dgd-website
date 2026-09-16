"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function UsernameSetup() {
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    let generation = 0;
    async function check(session) {
      const current = ++generation;
      if (!session?.user) { if (active) setUser(null); return; }
      const {data:profile,error} = await supabase.from("profiles").select("username").eq("id",session.user.id).maybeSingle();
      if (!active || current !== generation || error) return;
      const email = session.user.email || "";
      const needsName = !profile?.username || profile.username.includes("@") || profile.username.toLowerCase() === email.split("@")[0].toLowerCase();
      setUser(needsName ? session.user : null);
    }
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,session) => { setTimeout(() => { if(active) check(session); },0); });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  if (!user) return null;
  async function save(event) {
    event.preventDefault();
    const username = name.trim().toLowerCase().replace(/^@/, "");
    if (!/^[a-z0-9_]{3,30}$/.test(username) || username === user.email?.split("@")[0].toLowerCase()) {
      setError("Choose 3–30 letters, numbers, or underscores, different from your email name."); return;
    }
    setSaving(true); setError("");
    const {error} = await supabase.from("profiles").upsert({id:user.id,username},{onConflict:"id"});
    if (error) { setError(error.code === "23505" ? "That username is taken. Try another." : "Could not save your username. Please try again."); setSaving(false); return; }
    window.location.reload();
  }
  return <div className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center p-5" role="dialog" aria-modal="true" aria-labelledby="username-title">
    <form onSubmit={save} className="w-full max-w-md rounded-2xl border border-white/20 bg-zinc-950 p-6 space-y-5">
      <h2 id="username-title" className="text-3xl font-black">Choose your DGD username</h2>
      <p className="text-zinc-300">This is your public name on DGD. Pick a name for your garage instead of using your email.</p>
      <label className="block">Public username<input autoFocus required autoComplete="username" minLength={3} maxLength={30} value={name} onChange={e=>setName(e.target.value)} className="mt-2 block w-full rounded-xl bg-black border border-white/30 p-3" /></label>
      {error && <p role="alert" className="text-orange-400">{error}</p>}
      <button disabled={saving} className="w-full rounded-xl bg-orange-500 text-black font-bold p-4">{saving ? "Saving…" : "Save username & continue"}</button>
      <button type="button" onClick={()=>supabase.auth.signOut()} className="w-full text-zinc-400 p-2">Sign out</button>
    </form>
  </div>;
}
