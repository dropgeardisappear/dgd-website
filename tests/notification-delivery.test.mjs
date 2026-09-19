import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const source = readFileSync(new URL('../lib/notifications/createNotification.js',import.meta.url),'utf8').replace(/import "server-only";/,'').replace(/import \{ createHash \} from "node:crypto";/,'').replace(/import \{[\s\S]*?\} from "@\/lib\/twilio";/,'').replace('export async function','async function');
function setup(preferences,duplicate=false) {
 let sent=0; let inserted;
 const db={from(table){return table==='notifications'?{insert(value){inserted=value;return {select(){return {single:async()=>({data:value,error:duplicate?{code:'23505'}:null})}}}}}:{select(){return {eq(){return {maybeSingle:async()=>({data:preferences})}}}}};}};
 const fn=new Function('createHash','getTwilioClient','getMessagingServiceSid','TwilioConfigurationError',source+';return createNotification;')(createHash,()=>({messages:{create:async()=>{sent++;return {sid:'test'}}}}),()=> 'test',class extends Error{});
 return {run:()=>fn({supabaseAdmin:db,userId:'owner',postId:'post',type:'likes',message:'Liked',preferenceKey:'likes',smsBody:'DGD test',eventKey:'like:post:actor'}),sent:()=>sent,id:()=>inserted.id};
}
test('only opted-in verified recipients receive SMS',async()=>{for(const prefs of [null,{likes:false,phone_verified:true,phone:'+15555555555'},{likes:true,phone_verified:false,phone:'+15555555555'}]){const x=setup(prefs);await x.run();assert.equal(x.sent(),0);}const x=setup({likes:true,phone_verified:true,phone:'+15555555555'});assert.equal((await x.run()).smsSent,true);assert.equal(x.sent(),1);});
test('duplicate event never sends another SMS',async()=>{const x=setup({likes:true,phone_verified:true,phone:'+15555555555'},true);await x.run();assert.equal(x.sent(),0);assert.match(x.id(),/^[a-f0-9-]{36}$/);});
