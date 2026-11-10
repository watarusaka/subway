import { CATEGORIES, localDate, parseDate } from './model.js';
import { validCurrency } from './currency.js';
import { validCampaign } from './campaigns.js';
import { validReminder } from './reminders.js';
// A versioned account snapshot. Conditional writes prevent silent cross-device data loss.
const clone=value=>JSON.parse(JSON.stringify(value));
const stable=value=>JSON.stringify(value, function(_key,v){return v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v});
export function validCloudData(value) {
 if(!value || !Array.isArray(value.subscriptions) || value.subscriptions.length>1000 || !Number.isFinite(value.budget) || value.budget<0 || value.budget>999999999)return false;
 const ids=new Set();
 return value.subscriptions.every(s=>{
  if(!s || typeof s.id!=='string' || !/^[a-zA-Z0-9-]{1,80}$/.test(s.id) || ids.has(s.id) || typeof s.name!=='string' || !s.name.trim() || s.name.length>50 || !Number.isInteger(s.price) || s.price<0 || s.price>999999999 || !['monthly','yearly'].includes(s.cycle) || !['active','paused','cancelled'].includes(s.status) || !CATEGORIES.includes(s.category) || typeof s.color!=='string' || !/^#[a-f0-9]{6}$/i.test(s.color) || typeof s.date!=='string' || !/^20\d{2}-\d{2}-\d{2}$/.test(s.date) || localDate(parseDate(s.date))!==s.date || !validReminder(s.reminder) || !validCampaign(s.campaign) || !validCurrency(s) || !['plan','note','url','logo'].every(k=>s[k]===undefined || typeof s[k]==='string') || (s.url&&!/^https?:\/\//i.test(s.url)))return false;
  ids.add(s.id);return true;
 });
}
export function supabaseStore(client,userId) {
 async function request(make){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);try{return await make(controller.signal);}finally{clearTimeout(timer)}}
 return {
  async read(){const {data,error}=await request(signal=>client.from('subway_data').select('payload,version').eq('user_id',userId).maybeSingle().abortSignal(signal));if(error)throw error;return data;},
  async write(payload,version){const {data,error}=await request(signal=>client.rpc('save_subway_data',{p_user_id:userId,p_payload:payload,p_expected_version:version}).abortSignal(signal));if(error)throw error;return data;},
 };
}
export function createCloudSync({store,storage,key,onData=()=>{},onStatus=()=>{},canApply=()=>true}) {
 const pendingKey=`${key}:sync-pending`,versionKey=`${key}:sync-version`,backupKey=`${key}:sync-backups`;
 let version=Number(storage.getItem(versionKey)||0), pending=JSON.parse(storage.getItem(pendingKey)||'null');
 let busy=false,ready=false,conflict=false,stopped=false;
 const status=state=>{if(!stopped)onStatus(state)};
 function check(row){if(row&&(!validCloudData(row.payload)||!Number.isSafeInteger(row.version)||row.version<1))throw Error('invalid_cloud_data');return row;}
 function acknowledge(row){check(row);version=row.version;storage.setItem(versionKey,String(version));}
 function backup(payload){if(!validCloudData(payload))return;const copies=JSON.parse(storage.getItem(backupKey)||'[]');if(!copies.some(x=>stable(x.payload)===stable(payload))){copies.push({at:new Date().toISOString(),payload:clone(payload)});storage.setItem(backupKey,JSON.stringify(copies));}}
 function fail(error){if(error?.code==='P0001'&&error?.message?.includes('sync_conflict')){conflict=true;status('conflict')}else status(['PGRST205','PGRST202','42501','42P01'].includes(error?.code)?'setup':'error')}
 async function flush(){
  if(busy||!ready||conflict||stopped||!pending)return;
  busy=true;status('saving');
  const sending=pending;
  try{
   const row=check(await store.write(sending.payload,version));
   acknowledge(row);
   if(pending===sending){storage.removeItem(pendingKey);pending=null;status('synced')}
   else {pending={...pending,baseVersion:version};storage.setItem(pendingKey,JSON.stringify(pending));}
  }catch(error){fail(error)}finally{busy=false;}
  if(pending&&!conflict&&!stopped&&pending!==sending)void flush();
 }
 async function initialize(local){
  if(busy||stopped)return local;busy=true;
  try{
   const row=check(await store.read());
   const remoteVersion=row?.version??0;
   if(pending){
    if(row&&stable(row.payload)===stable(pending.payload)){acknowledge(row);storage.removeItem(pendingKey);pending=null;ready=true;status('synced');return clone(row.payload)}
    if(remoteVersion!==pending.baseVersion){conflict=true;status('conflict');return clone(pending.payload)}
    version=remoteVersion;ready=true;return clone(pending.payload);
   }
   if(row){
    if(!storage.getItem(versionKey)&&local.subscriptions.length&&stable(local)!==stable(row.payload))backup(local);
    acknowledge(row);ready=true;status('synced');return clone(row.payload);
   }
   version=0;ready=true;if(local.subscriptions.length===0&&local.budget===15000){status('synced');return local;}pending={payload:clone(local),baseVersion:0};storage.setItem(pendingKey,JSON.stringify(pending));return local;
  }catch(error){fail(error);return local}finally{busy=false;if(ready&&pending&&!conflict)void flush();}
 }
 function enqueue(payload){
  if(stopped||!validCloudData(payload))return false;
  const next={payload:clone(payload),baseVersion:pending?.baseVersion??version};
  try{storage.setItem(pendingKey,JSON.stringify(next));pending=next;status(conflict?'conflict':'pending');void flush();return true}catch{status('storage');return false}
 }
 async function refresh(local){
  if(busy||stopped)return;
  if(!ready){const next=await initialize(local);if(stable(next)!==stable(local))onData(next);return;}
  if(pending){await flush();return;}
  if(!canApply())return;
  busy=true;
  try{const row=check(await store.read());if(pending||!canApply())return;if(!row){if(version===0){status('synced');return;}throw Error('missing_cloud_data');}if(row.version!==version){storage.setItem(key,JSON.stringify(row.payload));acknowledge(row);onData(clone(row.payload));}status(pending?'pending':'synced')}catch(error){fail(error)}finally{busy=false;if(pending&&!conflict)void flush();}
 }
 async function acceptRemote(local){
  if(busy||stopped)return;busy=true;
  try{const row=check(await store.read());if(!row)throw Error('missing_cloud_data');backup(pending?.payload??local);storage.setItem(key,JSON.stringify(row.payload));acknowledge(row);storage.removeItem(pendingKey);pending=null;conflict=false;ready=true;onData(clone(row.payload));status('synced')}catch(error){fail(error)}finally{busy=false}
 }
 return {initialize,enqueue,refresh,acceptRemote,backups:()=>JSON.parse(storage.getItem(backupKey)||'[]'),stop:()=>{stopped=true}};
}
