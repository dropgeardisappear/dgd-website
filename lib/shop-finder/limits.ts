import 'server-only';
import {createHash} from 'node:crypto';
import {paymentDatabase} from '@/lib/shop/supabase-server';
export async function reserveAI(request:Request){
 try{const db=paymentDatabase(),now=Date.now();
 const ip=request.headers.get('x-vercel-forwarded-for')||'local';
 const hash=createHash('sha256').update(ip).digest('hex').slice(0,24);
 for(const [key,max,period] of [[`ai-minute:${hash}`,10,60000],['ai-daily',200,86400000]] as const){
 const window=Math.floor(now/period);const r=await db.rpc('directory_take_usage',{bucket_key:`${key}:${window}`,maximum:max,expiry:new Date((window+1)*period).toISOString()});if(r.error||r.data!==true)return false;
 }return true;
 }catch{return false;}
}
