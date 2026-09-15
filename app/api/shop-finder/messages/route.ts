import {userDatabase,failure} from '@/lib/shop-finder/server';
export async function GET(req:Request){
 try {const a=await userDatabase(req);if(!a)return failure('Sign in to view your inbox.',401);
 const {data,error}=await a.db.from('directory_messages').select('id,shop_id,kind,body,email,photos,created_at,directory_shops(name)').order('created_at',{ascending:false}).limit(100);
 if(error)throw error;return Response.json({messages:data},{headers:{'Cache-Control':'no-store'}});
 }catch{return failure('Inbox is temporarily unavailable.',503);}
}
export async function POST(req:Request){
 try{const a=await userDatabase(req);if(!a)return failure('Sign in to send a request or report.',401);
 if(Number(req.headers.get('content-length'))>1500000)return failure('Keep quote photos under 500 KB each.',413);
 const d=await req.json();
 const photos=Array.isArray(d.photos)?d.photos:[];
 if(photos.length>2||photos.some((p:unknown)=>typeof p!=='string'||p.length>670000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(p)))return failure('Use up to two JPG, PNG, or WebP photos under 500 KB each.');
 if(!['quote','report'].includes(d.kind)||typeof d.body!=='string'||d.body.trim().length<10||d.body.length>3000||typeof d.email!=='string'||d.email.length>254||!/^\S+@\S+\.\S+$/.test(d.email))return failure('Add a valid email and 10–3,000 characters of detail.');
 const {error}=await a.db.from('directory_messages').insert({shop_id:d.shopId,sender_id:a.user.id,kind:d.kind,body:d.body.trim(),email:d.email.trim(),photos:d.kind==='quote'?photos:[]});
 if(error)throw error;return Response.json({message:d.kind==='quote'?'Request saved to the shop’s DGD inbox. Contact the shop directly for urgent work.':'Report sent to DGD for review.'});
 }catch{return failure('Could not send. Please try again.',400);}
}
