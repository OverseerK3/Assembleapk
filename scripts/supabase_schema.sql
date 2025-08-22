-- Supabase schema and policies aligned to the app code (idempotent)
-- Run this SQL in the Supabase SQL editor.

-- 1) profiles table (minimal fields used by the app)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  full_name text,
  role text,
  bio text,
  website text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure columns exist (safe add if missing)
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='avatar_url') then
    alter table public.profiles add column avatar_url text;
  end if;
end $$;

alter table public.profiles enable row level security;
-- Read: everyone can read basic profiles (adjust if you want private)
drop policy if exists profiles_select_all on public.profiles;
create policy profiles_select_all on public.profiles for select using (true);
-- Upsert/update: only the owner can write their row
drop policy if exists profiles_upsert_owner on public.profiles;
create policy profiles_upsert_owner on public.profiles for insert with check (auth.uid() = id);
drop policy if exists profiles_update_owner on public.profiles;
create policy profiles_update_owner on public.profiles for update using (auth.uid() = id);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_online boolean not null default false,
  -- simple category tag used in app filters: one of
  -- 'hackathon' | 'tech event' | 'workshop' | 'projects' | 'tech meetup'
  category text,
  published boolean not null default true,
  location text,
  website text,
  banner_url text,
  min_team_size int,
  max_team_size int,
  created_at timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='organization_id') then
    alter table public.events add column organization_id uuid;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='starts_at') then
    alter table public.events add column starts_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='ends_at') then
    alter table public.events add column ends_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='is_online') then
    alter table public.events add column is_online boolean default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='category') then
    alter table public.events add column category text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='published') then
    alter table public.events add column published boolean not null default true;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='location') then
    alter table public.events add column location text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='website') then
    alter table public.events add column website text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='banner_url') then
    alter table public.events add column banner_url text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='min_team_size') then
    alter table public.events add column min_team_size int;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='max_team_size') then
    alter table public.events add column max_team_size int;
  end if;
end $$;

-- Event interests ("interested" likes)
create table if not exists public.event_interests (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- Index to speed up user queries
create index if not exists event_interests_user_idx on public.event_interests(user_id);

-- RLS
alter table public.event_interests enable row level security;
drop policy if exists event_interests_select on public.event_interests;
create policy event_interests_select on public.event_interests
  for select using (true);
drop policy if exists event_interests_insert on public.event_interests;
create policy event_interests_insert on public.event_interests
  for insert with check (auth.uid() = user_id);
drop policy if exists event_interests_delete on public.event_interests;
create policy event_interests_delete on public.event_interests
  for delete using (auth.uid() = user_id);

alter table public.events enable row level security;

-- RLS Policies for events
drop policy if exists events_select_all on public.events;
create policy events_select_all
  on public.events for select
  using (
    -- Public can read published events; owners can read their own
    (published is true) or (auth.uid() = organization_id)
  );

drop policy if exists events_insert_owner on public.events;
create policy events_insert_owner
  on public.events for insert
  with check (auth.uid() = organization_id);

drop policy if exists events_update_owner on public.events;
create policy events_update_owner
  on public.events for update
  using (auth.uid() = organization_id);

drop policy if exists events_delete_owner on public.events;
create policy events_delete_owner
  on public.events for delete
  using (auth.uid() = organization_id);

-- Helpful indexes for feed queries
-- Time/category/published indexes
create index if not exists events_starts_at_idx on public.events (starts_at asc);
create index if not exists events_ends_at_idx on public.events (ends_at asc);
create index if not exists events_category_idx on public.events (category);
create index if not exists events_published_starts_idx on public.events (published, starts_at asc);

-- Enable trigram search for fast ILIKE searches
create extension if not exists pg_trgm;
create index if not exists events_title_trgm_idx on public.events using gin (title gin_trgm_ops);
create index if not exists events_desc_trgm_idx on public.events using gin (description gin_trgm_ops);

-- Scalable feed RPC with filters and keyset pagination
create or replace function public.events_feed(
  search text default null,
  in_category text default null,
  after timestamptz default null,
  in_limit int default 20
)
returns table (
  id uuid,
  organization_id uuid,
  title text,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_online boolean,
  category text,
  location text,
  website text,
  banner_url text,
  min_team_size int,
  max_team_size int,
  org_name text,
  org_avatar_url text
)
language sql stable
as $$
  select e.id, e.organization_id, e.title, e.description, e.starts_at, e.ends_at, e.is_online, e.category, e.location, e.website, e.banner_url, e.min_team_size, e.max_team_size,
         p.full_name as org_name, p.avatar_url as org_avatar_url
  from public.events e
  left join public.profiles p on p.id = e.organization_id
  where e.published is true
    and e.ends_at >= now()
    and (after is null or e.starts_at > after)
    and (in_category is null or e.category = in_category)
    and (
      search is null or
      e.title ilike '%'||search||'%' or
      e.description ilike '%'||search||'%' or
      p.full_name ilike '%'||search||'%'
    )
  order by e.starts_at asc, e.id asc
  limit greatest(1, least(in_limit, 100));
$$;

-- 2b) event participants (registrations/joins)
create table if not exists public.event_participants (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.event_participants enable row level security;
drop policy if exists event_participants_select_all on public.event_participants;
create policy event_participants_select_all on public.event_participants for select using (true);
drop policy if exists event_participants_insert_self on public.event_participants;
create policy event_participants_insert_self on public.event_participants for insert with check (auth.uid() = user_id);
drop policy if exists event_participants_delete_self on public.event_participants;
create policy event_participants_delete_self on public.event_participants for delete using (auth.uid() = user_id);

-- prevent duplicate joins
create unique index if not exists event_participants_event_user_uidx on public.event_participants (event_id, user_id);

-- Index for participant queries
create index if not exists event_participants_user_idx on public.event_participants (user_id);

-- RPC: events joined by current user (auth.uid()) with status filter and pagination
create or replace function public.joined_events_feed(
  in_status text default null, -- 'upcoming' | 'completed' | null
  after timestamptz default null,
  in_limit int default 50
)
returns table (
  id uuid,
  organization_id uuid,
  title text,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_online boolean,
  category text,
  location text,
  website text,
  banner_url text,
  min_team_size int,
  max_team_size int,
  org_name text,
  org_avatar_url text
)
language sql stable
as $$
  select e.id, e.organization_id, e.title, e.description, e.starts_at, e.ends_at, e.is_online, e.category, e.location, e.website, e.banner_url, e.min_team_size, e.max_team_size,
         p.full_name as org_name, p.avatar_url as org_avatar_url
  from public.event_participants ep
  join public.events e on e.id = ep.event_id
  left join public.profiles p on p.id = e.organization_id
  where ep.user_id = auth.uid()
    and (in_status is null or (in_status = 'upcoming' and e.ends_at >= now()) or (in_status = 'completed' and e.ends_at < now()))
    and (after is null or e.starts_at > after)
  order by e.starts_at asc, e.id asc
  limit greatest(1, least(in_limit, 100));
$$;

-- 2c) social follows
create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followee_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id)
);

alter table public.follows enable row level security;
drop policy if exists follows_select_all on public.follows;
create policy follows_select_all on public.follows for select using (true);
drop policy if exists follows_insert_self on public.follows;
create policy follows_insert_self on public.follows for insert with check (auth.uid() = follower_id);
drop policy if exists follows_delete_self on public.follows;
create policy follows_delete_self on public.follows for delete using (auth.uid() = follower_id);

-- 3) Storage bucket for media (public read)
insert into storage.buckets (id, name, public)
  values ('event-banners','event-banners', true)
  on conflict (id) do nothing;

-- Replace any previous broad policies for this bucket
drop policy if exists storage_event_banners_read on storage.objects;
drop policy if exists storage_event_banners_insert on storage.objects;
drop policy if exists storage_event_banners_update on storage.objects;
drop policy if exists storage_event_banners_delete on storage.objects;

-- Public read of files in the bucket
create policy storage_event_banners_read
  on storage.objects for select
  using (bucket_id = 'event-banners');

-- Authenticated users can only write within their own subfolders:
-- avatars/{uid}/... and events/{uid}/...
create policy storage_event_banners_insert
  on storage.objects for insert
  with check (
    bucket_id = 'event-banners'
    and auth.role() = 'authenticated'
    and (
      (split_part(name, '/', 1) = 'avatars' and split_part(name, '/', 2) = auth.uid()::text)
      or
      (split_part(name, '/', 1) = 'events' and split_part(name, '/', 2) = auth.uid()::text)
    )
  );

create policy storage_event_banners_update
  on storage.objects for update
  using (
    bucket_id = 'event-banners'
    and auth.role() = 'authenticated'
    and (
      (split_part(name, '/', 1) = 'avatars' and split_part(name, '/', 2) = auth.uid()::text)
      or
      (split_part(name, '/', 1) = 'events' and split_part(name, '/', 2) = auth.uid()::text)
    )
  );

create policy storage_event_banners_delete
  on storage.objects for delete
  using (
    bucket_id = 'event-banners'
    and auth.role() = 'authenticated'
    and (
      (split_part(name, '/', 1) = 'avatars' and split_part(name, '/', 2) = auth.uid()::text)
      or
      (split_part(name, '/', 1) = 'events' and split_part(name, '/', 2) = auth.uid()::text)
    )
  );

-- Optional: CORS for Storage (manage via Dashboard > Storage > Settings)
-- Add dev origins like http://localhost:19006, http://127.0.0.1:19006, and your LAN URL.
