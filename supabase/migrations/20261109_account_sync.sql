-- Run in the Supabase SQL Editor for the subway project.
begin;
create table if not exists public.subway_data (
 user_id uuid primary key references auth.users(id) on delete cascade,
 payload jsonb not null,
 version bigint not null default 1 check (version > 0),
 updated_at timestamptz not null default now(),
 constraint subway_payload_shape check (
  jsonb_typeof(payload) = 'object'
  and jsonb_typeof(payload->'subscriptions') = 'array'
  and jsonb_typeof(payload->'budget') = 'number'
  and (payload->>'budget')::numeric between 0 and 999999999
  and jsonb_array_length(payload->'subscriptions') <= 1000
  and octet_length(payload::text) <= 2000000
  and payload ? 'subscriptions' and payload ? 'budget'
 )
);
alter table public.subway_data enable row level security;
revoke all on public.subway_data from anon, authenticated;
grant select, insert, update on public.subway_data to authenticated;
drop policy if exists subway_select_own on public.subway_data;
drop policy if exists subway_insert_own on public.subway_data;
drop policy if exists subway_update_own on public.subway_data;
create policy subway_select_own on public.subway_data for select to authenticated using ((select auth.uid()) = user_id);
create policy subway_insert_own on public.subway_data for insert to authenticated with check ((select auth.uid()) = user_id);
create policy subway_update_own on public.subway_data for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create or replace function public.save_subway_data(p_user_id uuid, p_payload jsonb, p_expected_version bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result public.subway_data;
begin
 if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'authentication_required' using errcode='28000'; end if;
 if p_expected_version = 0 then
  insert into public.subway_data(user_id,payload,version) values(auth.uid(),p_payload,1)
  on conflict(user_id) do nothing returning * into result;
 else
  update public.subway_data set payload=p_payload,version=version+1,updated_at=now()
  where user_id=auth.uid() and version=p_expected_version returning * into result;
 end if;
 if result.user_id is null then raise exception 'sync_conflict' using errcode='P0001'; end if;
 return jsonb_build_object('payload',result.payload,'version',result.version);
end;
$$;
revoke all on function public.save_subway_data(uuid,jsonb,bigint) from public, anon;
grant execute on function public.save_subway_data(uuid,jsonb,bigint) to authenticated;
commit;
