-- Find games within a given radius (in miles) of a point
-- Callable via supabase.rpc('nearby_games', { lat, lng, radius_miles })
create or replace function public.nearby_games(
  lat double precision,
  lng double precision,
  radius_miles double precision default 20
)
returns setof public.games
language sql
stable
security definer
as $$
  select *
  from public.games
  where is_cancelled = false
    and game_datetime > now()
    and location is not null
    and extensions.st_dwithin(
          location,
          extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography,
          radius_miles * 1609.34  -- convert miles to meters
        )
  order by game_datetime;
$$;

-- Find available players within a given radius (in miles)
-- Callable via supabase.rpc('nearby_available_players', { lat, lng, radius_miles })
create or replace function public.nearby_available_players(
  lat double precision,
  lng double precision,
  radius_miles double precision default 20
)
returns table (
  id uuid,
  user_id uuid,
  status public.availability_status,
  available_until timestamptz,
  location extensions.geography,
  preferred_format public.game_format,
  created_at timestamptz,
  username text,
  dupr_rating numeric(3,2),
  avatar_url text
)
language sql
stable
security definer
as $$
  select
    ap.id,
    ap.user_id,
    ap.status,
    ap.available_until,
    ap.location,
    ap.preferred_format,
    ap.created_at,
    u.username,
    u.dupr_rating,
    u.avatar_url
  from public.available_players ap
  join public.users u on u.id = ap.user_id
  where ap.status = 'available'
    and ap.available_until > now()
    and ap.location is not null
    and extensions.st_dwithin(
          ap.location,
          extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography,
          radius_miles * 1609.34
        )
  order by ap.available_until;
$$;

-- Delete expired availability entries to prevent table bloat
-- Callable via supabase.rpc('cleanup_expired_availability') or Edge Function
create or replace function public.cleanup_expired_availability()
returns integer
language plpgsql
security definer
as $$
declare
  deleted_count integer;
begin
  delete from public.available_players
  where available_until < now();

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- Find games matching a player's skill level
-- Callable via supabase.rpc('games_for_skill_level', { rating })
create or replace function public.games_for_skill_level(
  rating numeric
)
returns setof public.games
language sql
stable
security definer
as $$
  select *
  from public.games
  where is_cancelled = false
    and game_datetime > now()
    and (skill_level_min is null or skill_level_min <= rating)
    and (skill_level_max is null or skill_level_max >= rating)
  order by game_datetime;
$$;
