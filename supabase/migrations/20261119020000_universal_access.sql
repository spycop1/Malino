-- MALINO 0.7: Aktivierung per gemeinsamem, serverseitig geprüftem Zugangscode.
-- Erst nach Konfiguration von Anonymous Sign-Ins und MALINO_ACCESS_CODE aktivieren.
create table if not exists public.malino_access_grants (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  activated_at timestamptz not null default now(),
  revoked_at timestamptz null
);
alter table public.malino_access_grants enable row level security;
create policy malino_access_grants_read on public.malino_access_grants
  for select to authenticated using ((select auth.uid()) = owner_id);
revoke all on public.malino_access_grants from public, anon, authenticated;
grant select on public.malino_access_grants to authenticated;

-- Projektweites Tagesbudget verhindert unbegrenzte Kosten durch erneut erstellte Gastsitzungen.
create table if not exists public.malino_global_budget(
  day date primary key, used integer not null default 0 check (used >= 0)
);
create table if not exists public.malino_global_config(
  id integer primary key check (id=1),
  daily_limit integer not null default 50 check (daily_limit between 1 and 1000)
);
insert into public.malino_global_config (id,daily_limit) values (1,50)
  on conflict (id) do nothing;
alter table public.malino_global_budget enable row level security;
alter table public.malino_global_config enable row level security;
revoke all on public.malino_global_budget,public.malino_global_config from public,anon,authenticated;

-- Sperre die Erstellung eigener Cloud-Daten ohne vorherige Code-Freischaltung.
drop policy if exists malino_settings_insert on public.malino_settings;
create policy malino_settings_insert on public.malino_settings for insert to authenticated
with check ((select auth.uid())=owner_id and exists(
  select 1 from public.malino_access_grants a where a.owner_id=(select auth.uid()) and a.revoked_at is null
));
drop policy if exists malino_artworks_insert on public.malino_artworks;
create policy malino_artworks_insert on public.malino_artworks for insert to authenticated
with check ((select auth.uid())=owner_id and exists(
  select 1 from public.malino_access_grants a where a.owner_id=(select auth.uid()) and a.revoked_at is null
));
drop policy if exists malino_print_events_insert on public.malino_print_events;
create policy malino_print_events_insert on public.malino_print_events for insert to authenticated
with check ((select auth.uid())=owner_id and exists(
  select 1 from public.malino_access_grants a where a.owner_id=(select auth.uid()) and a.revoked_at is null
));
drop policy if exists malino_storage_create on storage.objects;
create policy malino_storage_create on storage.objects for insert to authenticated
with check (bucket_id='malino-artworks'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists(select 1 from public.malino_access_grants a
    where a.owner_id=(select auth.uid()) and a.revoked_at is null));

-- Atomare Prüfung sowohl des Geräte- als auch des gesamten Projektlimits.
create or replace function public.malino_reserve_generation(p_user_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  v_day date := (now() at time zone 'Europe/Berlin')::date;
  v_global integer;
  v_global_limit integer;
  v_local integer;
  v_local_limit integer;
begin
  if p_user_id is null or not exists(
    select 1 from public.malino_access_grants where owner_id=p_user_id and revoked_at is null
  ) then return false; end if;

  insert into public.malino_global_budget(day,used) values(v_day,0) on conflict do nothing;
  select used into v_global from public.malino_global_budget where day=v_day for update;
  select daily_limit into v_global_limit from public.malino_global_config where id=1;
  if v_global_limit is null or v_global >= v_global_limit then return false; end if;

  select coalesce((select daily_limit from public.malino_settings where owner_id=p_user_id),5)
    into v_local_limit;
  insert into public.malino_usage(owner_id,day,used) values(p_user_id,v_day,0)
    on conflict do nothing;
  select used into v_local from public.malino_usage
    where owner_id=p_user_id and day=v_day for update;
  if v_local >= v_local_limit then return false; end if;

  update public.malino_usage set used=used+1 where owner_id=p_user_id and day=v_day;
  update public.malino_global_budget set used=used+1 where day=v_day;
  return true;
end; $$;

create or replace function public.malino_refund_generation(p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_day date := (now() at time zone 'Europe/Berlin')::date;
begin
  update public.malino_usage set used=greatest(0,used-1)
  where owner_id=p_user_id and day=v_day;
  if found then
    update public.malino_global_budget set used=greatest(0,used-1) where day=v_day;
  end if;
end; $$;
revoke all on function public.malino_reserve_generation(uuid) from public,anon,authenticated;
revoke all on function public.malino_refund_generation(uuid) from public,anon,authenticated;
grant execute on function public.malino_reserve_generation(uuid) to service_role;
grant execute on function public.malino_refund_generation(uuid) to service_role;
