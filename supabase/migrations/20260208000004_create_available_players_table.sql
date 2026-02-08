-- Players who are currently available to play
create table public.available_players (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  status           public.availability_status not null default 'available',
  available_until  timestamptz not null,
  location         extensions.geography(point, 4326),
  preferred_format public.game_format,
  created_at       timestamptz not null default now()
);

comment on table public.available_players is 'Tracks which players are currently available to play.';

-- Only one active availability entry per user at a time
create unique index one_active_availability_per_user
  on public.available_players (user_id)
  where status = 'available';
