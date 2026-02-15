-- Update nearby_available_players to also return first_name and last_name
-- Postgres cannot CREATE OR REPLACE a function if the OUT/return row type changes,
-- so we drop it first before recreating with the new return signature.
drop function if exists public.nearby_available_players(double precision, double precision, double precision);

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
  first_name text,
  last_name text,
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
    u.first_name,
    u.last_name,
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
