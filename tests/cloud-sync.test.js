import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudSync} from '../src/cloud-sync.js';
const snapshot=(budget=1000)=>({subscriptions:[],demo:false,budget});
function storage(){const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}}
function backend(){let row=null;let online=true;return {read:async()=>{if(!online)throw Error('offline');return structuredClone(row)},write:async(payload,version)=>{if(!online)throw Error('offline');if((row?.version??0)!==version)throw {code:'P0001',message:'sync_conflict'};row={payload:structuredClone(payload),version:version+1};return structuredClone(row)},offline:()=>online=false,online:()=>online=true}}
const tick=async()=>{await new Promise(r=>setTimeout(r,10))};
test('Macとスマホで同一アカウントの追加・変更・削除・予算を共有する',async()=>{
 const store=backend(),aStore=storage(),bStore=storage();let phone;
 const a=createCloudSync({store,storage:aStore,key:'u'}),b=createCloudSync({store,storage:bStore,key:'u',onData:d=>phone=d});
 await a.initialize(snapshot());await tick();assert.deepEqual(await b.initialize(snapshot(9999)),snapshot());
 const data={...snapshot(8000),subscriptions:[{id:'one',name:'Netflix',price:1000,cycle:'monthly',status:'active',date:'2026-11-01',category:'エンタメ',color:'#304d38',reminder:{enabled:true,date:'2026-12-01',days:3}}]};
 a.enqueue(data);await tick();await b.refresh(snapshot());assert.deepEqual(phone,data);
 a.enqueue(snapshot(7000));await tick();await b.refresh(data);assert.deepEqual(phone,snapshot(7000));
});
test('同時編集を上書きせず競合として保持し、読み直し前に退避する',async()=>{
 const store=backend(),mem=storage();let state,visible;
 const a=createCloudSync({store,storage:storage(),key:'u'}),b=createCloudSync({store,storage:mem,key:'u',onStatus:s=>state=s,onData:d=>visible=d});
 await a.initialize(snapshot());await tick();await b.initialize(snapshot());
 a.enqueue(snapshot(2000));await tick();b.enqueue(snapshot(3000));await tick();assert.equal(state,'conflict');assert.equal((await store.read()).payload.budget,2000);
 await b.acceptRemote(snapshot(3000));assert.equal(visible.budget,2000);assert.equal(b.backups()[0].payload.budget,3000);assert.equal(mem.getItem('u:sync-pending'),null);
});
test('オフライン中の編集を再起動後も保持して再接続時に送る',async()=>{
 const store=backend(),mem=storage();const a=createCloudSync({store,storage:mem,key:'u'});
 await a.initialize(snapshot());await tick();store.offline();a.enqueue(snapshot(5000));await tick();a.stop();
 store.online();const b=createCloudSync({store,storage:mem,key:'u'});assert.equal((await b.initialize(snapshot())).budget,5000);await tick();assert.equal((await store.read()).payload.budget,5000);assert.equal(mem.getItem('u:sync-pending'),null);
});
test('保存応答が失われても同じデータを再送せずに復帰できる',async()=>{
 const store=backend(),mem=storage();const a=createCloudSync({store,storage:mem,key:'u'});await a.initialize(snapshot());await tick();
 const broken={...store,write:async(...args)=>{await store.write(...args);throw Error('response lost')}};
 const b=createCloudSync({store:broken,storage:mem,key:'u'});await b.initialize(snapshot());b.enqueue(snapshot(6000));await tick();b.stop();
 const before=(await store.read()).version;const c=createCloudSync({store,storage:mem,key:'u'});assert.equal((await c.initialize(snapshot())).budget,6000);await tick();assert.equal((await store.read()).version,before);
});
test('リモート読込中に編集された内容を上書きしない',async()=>{
 let resolve;const store=backend(),mem=storage();let applied=false;
 const a=createCloudSync({store,storage:mem,key:'u',onData:()=>applied=true});await a.initialize(snapshot());await tick();
 const original=store.read;store.read=()=>new Promise(r=>resolve=r);
 const fetching=a.refresh(snapshot());a.enqueue(snapshot(1234));resolve({payload:snapshot(9876),version:2});await fetching;
 assert.equal(applied,false);await tick();assert.equal((await original()).payload.budget,1234);
 store.read=original;
});
test('設定前でも端末内のデータを保持し、未同期表示を返す',async()=>{
 let state;const mem=storage();const a=createCloudSync({store:{read:async()=>{throw {code:'PGRST205'}},write:async()=>{throw Error()}},storage:mem,key:'u',onStatus:s=>state=s});
 assert.deepEqual(await a.initialize(snapshot(123)),snapshot(123));assert.equal(state,'setup');assert.equal(a.enqueue(snapshot(456)),true);assert.equal(JSON.parse(mem.getItem('u:sync-pending')).payload.budget,456);
});
test('先に空のスマホで開いてもMacの既存データの初期取り込みを妨げない',async()=>{
 const store=backend();let displayed;
 const phone=createCloudSync({store,storage:storage(),key:'u',onData:d=>displayed=d});
 await phone.initialize(snapshot(15000));await tick();assert.equal(await store.read(),null);
 const mac=createCloudSync({store,storage:storage(),key:'u'});await mac.initialize(snapshot(9876));await tick();
 await phone.refresh(snapshot(15000));assert.equal(displayed.budget,9876);
});
