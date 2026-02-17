-- Returns past games that a user either created or joined (confirmed RSVP).
create or replace function public.user_past_games(p_user_id uuid)
returns table (
  id uuid,
  creator_id uuid,
  game_datetime timestamptz,
  location_name text,
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
  creator_last_name text
)
language sql
stable
security definer
as $$
  select
    g.id,
    g.creator_id,
    g.game_datetime,
    g.location_name,
    g.skill_level_min,
    g.skill_level_max,
    g.spots_available,
    g.spots_filled,
    g.game_format,
    g.description,
    g.is_cancelled,
    g.created_at,
    g.updated_at,
    u.username as creator_username,
    u.first_name as creator_first_name,
    u.last_name as creator_last_name
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
