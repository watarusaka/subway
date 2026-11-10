import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
test('PostgreSQLの所有者制限・同時更新・入力検証・未ログイン拒否', async()=>{
const db=new PGlite();
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${a}'),('${b}');create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;`);
 const sql=readFileSync(new URL('../supabase/migrations/20261109_account_sync.sql',import.meta.url),'utf8');
 await db.exec(sql);await db.exec(sql);
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${a}',false);`);
 const payload=JSON.stringify({subscriptions:[],budget:5000,demo:false});
 const saved=await db.query('select public.save_subway_data($1,$2::jsonb,0) as result',[a,payload]);assert.equal(saved.rows[0].result.version,1);
 await assert.rejects(()=>db.query('select public.save_subway_data($1,$2::jsonb,0)',[a,payload]),/sync_conflict/);
 await db.exec(`select set_config('request.jwt.claim.sub','${b}',false);`);
 assert.equal((await db.query('select * from public.subway_data')).rows.length,0);
 await assert.rejects(()=>db.query('select public.save_subway_data($1,$2::jsonb,1)',[a,payload]),/authentication_required/);
 assert.equal((await db.query('update public.subway_data set payload=$1::jsonb where user_id=$2 returning *',[payload,a])).rows.length,0);
 await assert.rejects(()=>db.query('insert into public.subway_data(user_id,payload) values($1,$2::jsonb)',[a,payload]),/row-level security/);
 await db.query('select public.save_subway_data($1,$2::jsonb,0)',[b,payload]);
 assert.equal((await db.query('select * from public.subway_data')).rows.length,1);
 await assert.rejects(()=>db.query('select public.save_subway_data($1,$2::jsonb,1)',[b,JSON.stringify({subscriptions:[],budget:-1})]),/check constraint/);
 await db.exec('set role anon;');await assert.rejects(()=>db.query('select * from public.subway_data'),/permission denied/);
 await assert.rejects(()=>db.query('select public.save_subway_data($1,$2::jsonb,0)',[a,payload]),/permission denied/);
 console.log('PostgreSQL: repeatable migration, own-data save, stale-write rejection, account isolation, invalid payload rejection, anonymous denial: passed');
}finally{await db.close()}

});
