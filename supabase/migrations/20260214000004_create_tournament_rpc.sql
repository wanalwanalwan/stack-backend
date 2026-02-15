-- Find tournaments within a given radius (in miles) of a point
-- Follows same PostGIS pattern as nearby_games
create or replace function public.nearby_tournaments(
  lat double precision,
  lng double precision,
  radius_miles double precision default 50
)
returns setof public.tournaments
language sql
stable
security definer
as $$
  select *
  from public.tournaments
  where start_date >= current_date
    and location is not null
    and extensions.st_dwithin(
          location,
          extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography,
          radius_miles * 1609.34  -- convert miles to meters
        )
  order by start_date;
$$;
