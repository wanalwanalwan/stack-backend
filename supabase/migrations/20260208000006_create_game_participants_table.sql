-- RSVP records for game participants
create table public.game_participants (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references public.games(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  rsvp_status public.rsvp_status not null default 'confirmed',
  created_at  timestamptz not null default now(),

  constraint unique_user_per_game unique (game_id, user_id)
);

comment on table public.game_participants is 'Tracks which users have RSVPed to which games.';
