-- La Grada content backend. Apply to the selected Supabase project only.
-- These new tables do not alter existing project tables or authentication.
begin;

create table public.lagrada_players (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  display_order integer not null unique check (display_order >= 0),
  profile jsonb not null check (jsonb_typeof(profile) = 'object'),
  historical_stats jsonb check (historical_stats is null or jsonb_typeof(historical_stats) = 'object'),
  published boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint profile_id_matches check (coalesce(profile ->> 'id' = id, false)),
  constraint profile_has_name check (coalesce(length(profile ->> 'name') > 0, false))
);

create table public.lagrada_stories (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  display_order integer not null unique check (display_order >= 0),
  story jsonb not null check (jsonb_typeof(story) = 'object'),
  published boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint story_id_matches check (coalesce(story ->> 'id' = id, false)),
  constraint story_has_title check (coalesce(length(story ->> 'title') > 0, false))
);

alter table public.lagrada_players enable row level security;
alter table public.lagrada_stories enable row level security;

revoke all on public.lagrada_players, public.lagrada_stories from public, anon, authenticated;
grant select on public.lagrada_players, public.lagrada_stories to anon, authenticated;
grant all on public.lagrada_players, public.lagrada_stories to service_role;

-- Only intentionally published football content is readable via the public API.
-- Browser clients cannot insert, update, delete, or publish any content.
create policy "Read published players" on public.lagrada_players
  for select to anon, authenticated using (published = true);
create policy "Read published stories" on public.lagrada_stories
  for select to anon, authenticated using (published = true);

commit;
