-- Games and drills (drills are games with game_format='drill')
create table public.games (
  id              uuid primary key default gen_random_uuid(),
  creator_id      uuid not null references public.users(id) on delete cascade,
  game_datetime   timestamptz not null,
  location        extensions.geography(point, 4326),
  location_name   text,
  skill_level_min numeric(3,2) check (skill_level_min >= 1.0 and skill_level_min <= 8.0),
  skill_level_max numeric(3,2) check (skill_level_max >= 1.0 and skill_level_max <= 8.0),
  spots_available smallint not null check (spots_available > 0),
  spots_filled    smallint not null default 0 check (spots_filled >= 0),
  game_format     public.game_format not null,
  description     text,
  is_cancelled    boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint skill_range_valid check (skill_level_min <= skill_level_max),
  constraint spots_not_overfilled check (spots_filled <= spots_available)
);

comment on table public.games is 'Scheduled games and drills. Drills use game_format=drill.';

create trigger games_updated_at
  before update on public.games
  for each row execute function public.handle_updated_at();
