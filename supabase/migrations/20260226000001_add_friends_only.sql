-- Add friends_only column to games table
alter table public.games
  add column if not exists friends_only boolean not null default false;

-- Update nearby_games to include friends_only
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
  friends_only boolean,
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
    g.description, g.is_cancelled, g.friends_only,
    g.created_at, g.updated_at,
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

-- Update user_past_games to include friends_only + round robin columns
drop function if exists public.user_past_games(uuid);

create or replace function public.user_past_games(p_user_id uuid)
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
  friends_only boolean,
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
    g.description, g.is_cancelled, g.friends_only,
    g.created_at, g.updated_at,
    u.username, u.first_name, u.last_name,
    extensions.st_y(g.location::extensions.geometry),
    extensions.st_x(g.location::extensions.geometry)
  from public.games g
  join public.users u on u.id = g.creator_id
  where g.game_datetime <= now()
    and (
      g.creator_id = p_user_id
      or exists (
        select 1 from public.game_participants gp
        where gp.game_id = g.id
          and gp.user_id = p_user_id
          and gp.rsvp_status = 'confirmed'
      )
    )
  order by g.game_datetime desc;
$$;

-- Update my_active_sessions to include friends_only
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
  friends_only boolean,
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
    g.description, g.is_cancelled, g.friends_only,
    g.created_at, g.updated_at,
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
