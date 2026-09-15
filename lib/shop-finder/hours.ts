export const weekdays=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export function openNow(schedule:any, timezone:string, now=new Date()) {
 if(!Array.isArray(schedule)||schedule.length!==7||!timezone)return false;
 try {const parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone,weekday:'long',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);const get=(k:string)=>parts.find(p=>p.type===k)?.value||'';const day=weekdays.indexOf(get('weekday'));const time=get('hour')+':'+get('minute');const today=schedule[day];const yesterday=schedule[(day+6)%7];
 return !!((today?.open && today?.close && (today.close>today.open ? time>=today.open&&time<today.close : time>=today.open)) || (yesterday?.open && yesterday?.close && yesterday.close<yesterday.open && time<yesterday.close));
 }catch{return false;}
}
