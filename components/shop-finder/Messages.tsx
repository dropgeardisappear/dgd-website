'use client';
import {useEffect,useState} from 'react';
import PhotoPicker from './PhotoPicker';
import {supabase} from '@/lib/supabase';
async function headers(){const {data:{session}}=await supabase.auth.getSession();return {'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token||''}`};}
export function ContactShop({shopId}:{shopId:string}){
 const [files,F]=useState<File[]>([]);
 const [kind,K]=useState('quote'),[body,B]=useState(''),[email,E]=useState(''),[message,M]=useState(''),[busy,S]=useState(false);
 const draftKey = `dgd-quote-draft:${shopId}`;
 useEffect(() => {
   try {
     const raw = sessionStorage.getItem(draftKey);
     if (!raw) return;
     const draft = JSON.parse(raw);
     if (!draft || !Number.isFinite(draft.expires) || draft.expires < Date.now() || !['quote','report'].includes(draft.kind) || typeof draft.body !== 'string' || draft.body.length > 3000 || typeof draft.email !== 'string' || draft.email.length > 254 || !Array.isArray(draft.photos) || draft.photos.length > 2) {
       sessionStorage.removeItem(draftKey); return;
     }
     const restored = draft.photos.map((p:any) => {
       if(typeof p.name !== 'string' || typeof p.data !== 'string' || p.data.length > 670000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(p.data)) throw Error('Invalid photo');
       const [header,encoded] = p.data.split(',');
       const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
       if(bytes.length > 500000) throw Error('Photo too large');
       return new File([bytes],p.name,{type:header.slice(5,header.indexOf(';'))});
     });
     K(draft.kind); B(draft.body); E(draft.email); F(restored);
     M('Your saved draft is restored. Review it before sending.');
   } catch { try { sessionStorage.removeItem(draftKey); } catch {} }
 }, [draftKey]);
 async function signIn(e: React.MouseEvent<HTMLAnchorElement>) {
   e.preventDefault(); if(busy) return; S(true); M('Saving your draft…');
   try {
     const photos = await Promise.all(files.map(file => new Promise<{name:string;data:string}>((resolve,reject) => {
       const reader = new FileReader(); reader.onload = () => resolve({name:file.name,data:String(reader.result)}); reader.onerror = () => reject(Error('Photo could not be saved')); reader.readAsDataURL(file);
     })));
     sessionStorage.setItem(draftKey,JSON.stringify({kind,body,email,photos,expires:Date.now()+30*60*1000}));
     window.location.assign(`/login?next=${encodeURIComponent(`/shop-finder/shops/${shopId}`)}`);
   } catch { M('Your browser could not save this draft. Copy your message and remove photos before trying sign-in again.'); S(false); }
 }

 return <section className="form-card"><h2>Contact this shop</h2><p>Quote requests go to this shop’s DGD inbox. Reports go to DGD for review. Sign in before sending.</p><a onClick={signIn} aria-disabled={busy} href={`/login?next=${encodeURIComponent(`/shop-finder/shops/${shopId}`)}`}>Sign in to DGD</a><p className="small">Signing in saves your draft in this browser tab for 30 minutes. It is sent only when you submit the request.</p><form onSubmit={async e=>{e.preventDefault();S(true);M('');try{const photos=kind==='quote'?await Promise.all(files.map(f=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('Could not read photo'));reader.readAsDataURL(f);} ))):[];const r=await fetch('/api/shop-finder/messages' ,{method:'POST',headers:await headers(),body:JSON.stringify({shopId,kind,body,email,photos})});const d=await r.json();M(d.message||d.error);if(r.ok){B('');F([]);try{sessionStorage.removeItem(draftKey);}catch{}}}catch{M('Could not send. Please try again.');}finally{S(false);}}}><label className="field">Message type<select value={kind} onChange={e=>K(e.target.value)}><option value="quote">Request a quote</option><option value="report">Report this listing</option></select></label><label className="field">Reply email<input type="email" required maxLength={254} value={email} onChange={e=>E(e.target.value)}/></label><label className="field">{kind==='quote'?'Vehicle year, make, model, and work needed':'What information is wrong?'}<textarea required minLength={10} maxLength={3000} value={body} onChange={e=>B(e.target.value)}/></label>{kind==='quote'&&<PhotoPicker files={files} onChange={F} maximum={2} label="Project photos (optional)" onError={M}/>}<p className="small">Your email, message, and any photos will be shared with {kind==='quote'?'this shop':'DGD reviewers'}.</p><button className="primary" disabled={busy}>{busy?'Sending…':kind==='quote'?'Send quote request':'Send report'}</button><p role="status">{message}</p></form></section>;
}
export function Inbox(){const [rows,R]=useState<any[]>([]),[message,M]=useState('Loading inbox…');useEffect(()=>{headers().then(h=>fetch('/api/shop-finder/messages',{headers:h})).then(r=>r.json()).then(d=>{R(d.messages||[]);M(d.error||(!d.messages?.length?'No requests or reports yet.':''));}).catch(()=>M('Inbox unavailable. Please try again.'));},[]);return <section className="form-card"><h2>Requests & reports</h2><p role="status">{message}</p>{rows.map(r=><article key={r.id} className="shop-card"><div><h3>{r.directory_shops?.name} · {r.kind==='quote'?'Quote request':'Listing report'}</h3><p style={{whiteSpace:'pre-wrap'}}>{r.body}</p><div className="grid3">{(r.photos||[]).map((photo:string,i:number)=><img src={photo} key={i} alt="Customer project" style={{maxWidth:"100%"}}/>)}</div><a href={`mailto:${r.email}`}>Reply to {r.email}</a><p className="small">{new Date(r.created_at).toLocaleString()}</p></div></article>)}</section>}
