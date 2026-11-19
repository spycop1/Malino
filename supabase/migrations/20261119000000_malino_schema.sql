-- MALINO 0.5: separater Supabase-Projektbereich. In einem EIGENEN Projekt ausführen.
-- Jede Familie wird über die authentifizierte Eltern-User-ID getrennt.

create table if not exists public.malino_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  child_name text not null default 'Kleiner Künstler' check (char_length(child_name) <= 40),
  age_group text not null default '4-6' check (age_group in ('3-4', '4-6', '7-10')),
  daily_limit integer not null default 5 check (daily_limit between 1 and 30),
  voice_enabled boolean not null default true,
  print_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
create table if not exists public.malino_usage (
  owner_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  used integer not null default 0 check (used >= 0),
  primary key (owner_id, day)
);
create table if not exists public.malino_artworks (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check(char_length(title) <= 160),
  mode text not null check (mode in ('fantasy','games','story','learning','gifts')),
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  check (storage_path like owner_id::text || '/%')
);
create table if not exists public.malino_print_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  artwork_id uuid null references public.malino_artworks(id) on delete set null,
  title text not null check(char_length(title) <= 160),
  mode text not null check (mode in ('fantasy','games','story','learning','gifts')),
  requested_at timestamptz not null default now()
);
create index if not exists malino_artworks_owner_date_idx on public.malino_artworks(owner_id,created_at desc);
create index if not exists malino_print_events_owner_date_idx on public.malino_print_events(owner_id,requested_at desc);

alter table public.malino_settings enable row level security;
alter table public.malino_usage enable row level security;
alter table public.malino_artworks enable row level security;
alter table public.malino_print_events enable row level security;

-- Lesen und Ändern nur für den jeweils angemeldeten Eltern-Account.
create policy malino_settings_select on public.malino_settings for select to authenticated using ((select auth.uid()) = owner_id);
create policy malino_settings_insert on public.malino_settings for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy malino_settings_update on public.malino_settings for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy malino_usage_select on public.malino_usage for select to authenticated using ((select auth.uid()) = owner_id);
create policy malino_artworks_select on public.malino_artworks for select to authenticated using ((select auth.uid()) = owner_id);
create policy malino_artworks_insert on public.malino_artworks for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy malino_artworks_delete on public.malino_artworks for delete to authenticated using ((select auth.uid()) = owner_id);
create policy malino_print_events_select on public.malino_print_events for select to authenticated using ((select auth.uid()) = owner_id);
create policy malino_print_events_insert on public.malino_print_events for insert to authenticated with check ((select auth.uid()) = owner_id);

-- Tabellenzugriff getrennt von RLS. Niemals Schreibrecht auf Nutzungszähler geben.
revoke all on table public.malino_settings, public.malino_usage, public.malino_artworks, public.malino_print_events from anon;
grant select,insert,update on table public.malino_settings to authenticated;
grant select on table public.malino_usage to authenticated;
grant select,insert,delete on table public.malino_artworks to authenticated;
grant select,insert on table public.malino_print_events to authenticated;

-- Reservierung ist ATOMAR und ausschließlich über die serverseitige Edge Function möglich.
create or replace function public.malino_reserve_generation(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'Europe/Berlin')::date;
  v_current integer;
  v_limit integer;
begin
  if p_user_id is null then return false; end if;
  select coalesce((select daily_limit from public.malino_settings where owner_id=p_user_id), 5)
  into v_limit;
  insert into public.malino_usage(owner_id, day, used)
    values(p_user_id,v_day,0) on conflict do nothing;
  select used into v_current from public.malino_usage
    where owner_id=p_user_id and day=v_day for update;
  if v_current >= v_limit then return false; end if;
  update public.malino_usage set used=used+1 where owner_id=p_user_id and day=v_day;
  return true;
end;
$$;
create or replace function public.malino_refund_generation(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.malino_usage set used=greatest(0,used-1)
  where owner_id=p_user_id and day=(now() at time zone 'Europe/Berlin')::date;
end;
$$;
revoke all on function public.malino_reserve_generation(uuid) from public, anon, authenticated;
revoke all on function public.malino_refund_generation(uuid) from public, anon, authenticated;
grant execute on function public.malino_reserve_generation(uuid) to service_role;
grant execute on function public.malino_refund_generation(uuid) to service_role;

-- Privater Storage-Bucket für Familienbilder.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values('malino-artworks','malino-artworks',false,8388608,array['image/png'])
on conflict (id) do nothing;

create policy malino_storage_read on storage.objects for select to authenticated
using (bucket_id='malino-artworks' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy malino_storage_create on storage.objects for insert to authenticated
with check (bucket_id='malino-artworks' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy malino_storage_delete on storage.objects for delete to authenticated
using (bucket_id='malino-artworks' and (storage.foldername(name))[1]=(select auth.uid())::text);
