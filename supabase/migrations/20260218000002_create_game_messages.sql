-- Create game_messages table for session text threads
create table public.game_messages (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.games(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  content    text not null check (char_length(content) > 0),
  created_at timestamptz not null default now()
);

create index idx_game_messages_game_created on public.game_messages(game_id, created_at);
create index idx_game_messages_user on public.game_messages(user_id);

-- RLS
alter table public.game_messages enable row level security;

-- Participants and creators can view messages
create policy "Game members can view messages"
  on public.game_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.game_participants gp
      where gp.game_id = game_messages.game_id
        and gp.user_id = auth.uid()
        and gp.rsvp_status = 'confirmed'
    )
    or exists (
      select 1 from public.games g
      where g.id = game_messages.game_id
        and g.creator_id = auth.uid()
    )
  );

-- Participants and creators can send messages
create policy "Game members can send messages"
  on public.game_messages for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and (
      exists (
        select 1 from public.game_participants gp
        where gp.game_id = game_messages.game_id
          and gp.user_id = auth.uid()
          and gp.rsvp_status = 'confirmed'
      )
      or exists (
        select 1 from public.games g
        where g.id = game_messages.game_id
          and g.creator_id = auth.uid()
      )
    )
  );

-- RPC: user's active (non-expired) joined sessions
create or replace function public.my_active_sessions(p_user_id uuid)
returns table (
  id uuid,
  creator_id uuid,
  game_datetime timestamptz,
  location_name text,
  session_name text,
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
    g.id,
    g.creator_id,
    g.game_datetime,
    g.location_name,
    g.session_name,
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
    u.last_name as creator_last_name,
    extensions.st_y(g.location::extensions.geometry) as latitude,
    extensions.st_x(g.location::extensions.geometry) as longitude
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
