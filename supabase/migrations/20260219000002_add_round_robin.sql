-- Session type enum
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'session_type'
  ) then
    create type public.session_type as enum ('casual', 'round_robin');
  end if;
end
$$;

-- Round robin lifecycle status
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'round_robin_status'
  ) then
    create type public.round_robin_status as enum ('waiting', 'in_progress', 'completed');
  end if;
end
$$;

-- Add new columns to games table
alter table public.games
  add column if not exists session_type public.session_type;

alter table public.games
  alter column session_type set default 'casual';

update public.games
set session_type = 'casual'
where session_type is null;

alter table public.games
  alter column session_type set not null;

alter table public.games
  add column if not exists num_rounds smallint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'games_num_rounds_positive'
  ) then
    alter table public.games
      add constraint games_num_rounds_positive
      check (num_rounds is null or num_rounds > 0);
  end if;
end
$$;

alter table public.games
  add column if not exists round_robin_status public.round_robin_status;

-- Round robin match table: one row per match (court) per round
create table public.round_robin_rounds (
  id              uuid primary key default gen_random_uuid(),
  game_id         uuid not null references public.games(id) on delete cascade,
  round_number    smallint not null check (round_number > 0),
  court_number    smallint not null default 1 check (court_number > 0),
  team1_player1   uuid not null references public.users(id),
  team1_player2   uuid references public.users(id),
  team2_player1   uuid not null references public.users(id),
  team2_player2   uuid references public.users(id),
  bye_players     uuid[] not null default '{}',
  team1_score     smallint check (team1_score is null or team1_score >= 0),
  team2_score     smallint check (team2_score is null or team2_score >= 0),
  score_entered_by uuid references public.users(id),
  created_at      timestamptz not null default now(),
  constraint unique_round_court unique (game_id, round_number, court_number)
);

-- Indexes
create index idx_rr_rounds_game on public.round_robin_rounds(game_id);
create index idx_rr_rounds_game_round on public.round_robin_rounds(game_id, round_number);

-- RLS
alter table public.round_robin_rounds enable row level security;

create policy "Round robin rounds are viewable by authenticated users"
  on public.round_robin_rounds for select
  to authenticated
  using (true);

create policy "Game creator can insert round robin rounds"
  on public.round_robin_rounds for insert
  to authenticated
  with check (
    exists (
      select 1 from public.games
      where id = game_id and creator_id = auth.uid()
    )
  );

create policy "Game participants can update round scores"
  on public.round_robin_rounds for update
  to authenticated
  using (
    exists (
      select 1 from public.game_participants
      where game_id = round_robin_rounds.game_id
        and user_id = auth.uid()
        and rsvp_status = 'confirmed'
    )
    or exists (
      select 1 from public.games
      where id = round_robin_rounds.game_id
        and creator_id = auth.uid()
    )
  );

-- Update nearby_games to include new columns
drop function if exists public.nearby_games(double precision, double precision, double precision);

create or replace function public.nearby_games(
  lat double precision,
  lng double precision,
  radius_miles double precision default 20
)
returns table (
  id uuid,
  creator_id uuid,
  game_datetime timestamptz,
  location_name text,
  session_name text,
  session_type public.session_type,
  num_rounds smallint,
  round_robin_status public.round_robin_status,
  skill_level_min numeric(3,2),
  skill_level_max numeric(3,2),
  spots_available smallint,
  spots_filled smallint,
  game_format public.game_format,
  description text,
  is_cancelled boolean,
  created_at timestamptz,
  updated_at timestamptz,
  creator_username text,
  creator_first_name text,
  creator_last_name text,
  latitude double precision,
  longitude double precision
)
language sql
stable
security definer
as $$
  select
    g.id, g.creator_id, g.game_datetime, g.location_name, g.session_name,
    g.session_type, g.num_rounds, g.round_robin_status,
    g.skill_level_min, g.skill_level_max,
    g.spots_available, g.spots_filled, g.game_format,
    g.description, g.is_cancelled, g.created_at, g.updated_at,
    u.username, u.first_name, u.last_name,
    extensions.st_y(g.location::extensions.geometry),
    extensions.st_x(g.location::extensions.geometry)
  from public.games g
  join public.users u on u.id = g.creator_id
  where g.is_cancelled = false
    and g.game_datetime > now()
    and (
      g.location is null
      or extensions.st_dwithin(
           g.location,
           extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography,
           radius_miles * 1609.34
         )
    )
  order by g.game_datetime;
$$;

-- Update my_active_sessions to include new columns
drop function if exists public.my_active_sessions(uuid);

create or replace function public.my_active_sessions(p_user_id uuid)
returns table (
  id uuid,
  creator_id uuid,
  game_datetime timestamptz,
  location_name text,
  session_name text,
  session_type public.session_type,
  num_rounds smallint,
  round_robin_status public.round_robin_status,
  skill_level_min numeric(3,2),
  skill_level_max numeric(3,2),
  spots_available smallint,
  spots_filled smallint,
  game_format public.game_format,
  description text,
  is_cancelled boolean,
  created_at timestamptz,
  updated_at timestamptz,
  creator_username text,
  creator_first_name text,
  creator_last_name text,
  latitude double precision,
  longitude double precision
)
language sql
stable
security definer
as $$
  select
    g.id, g.creator_id, g.game_datetime, g.location_name, g.session_name,
    g.session_type, g.num_rounds, g.round_robin_status,
    g.skill_level_min, g.skill_level_max,
    g.spots_available, g.spots_filled, g.game_format,
    g.description, g.is_cancelled, g.created_at, g.updated_at,
    u.username, u.first_name, u.last_name,
    extensions.st_y(g.location::extensions.geometry),
    extensions.st_x(g.location::extensions.geometry)
  from public.games g
  join public.users u on u.id = g.creator_id
  where g.is_cancelled = false
    and g.game_datetime > now()
    and (
      g.creator_id = p_user_id
      or exists (
        select 1 from public.game_participants gp
        where gp.game_id = g.id
          and gp.user_id = p_user_id
          and gp.rsvp_status = 'confirmed'
      )
    )
  order by g.game_datetime;
$$;
