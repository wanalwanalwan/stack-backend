-- Enable Row Level Security on all tables
alter table public.users enable row level security;
alter table public.available_players enable row level security;
alter table public.games enable row level security;
alter table public.game_participants enable row level security;
alter table public.tournaments enable row level security;

-- ============================================================
-- USERS
-- ============================================================
create policy "Users are viewable by authenticated users"
  on public.users for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on public.users for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.users for insert
  to authenticated
  with check (auth.uid() = id);

-- ============================================================
-- AVAILABLE PLAYERS
-- ============================================================
create policy "Available players are viewable by authenticated users"
  on public.available_players for select
  to authenticated
  using (true);

create policy "Users can insert their own availability"
  on public.available_players for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own availability"
  on public.available_players for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own availability"
  on public.available_players for delete
  to authenticated
  using (auth.uid() = user_id);

-- ============================================================
-- GAMES
-- ============================================================
create policy "Games are viewable by authenticated users"
  on public.games for select
  to authenticated
  using (true);

create policy "Users can create games"
  on public.games for insert
  to authenticated
  with check (auth.uid() = creator_id);

create policy "Creators can update their own games"
  on public.games for update
  to authenticated
  using (auth.uid() = creator_id)
  with check (auth.uid() = creator_id);

-- ============================================================
-- GAME PARTICIPANTS
-- ============================================================
create policy "Game participants are viewable by authenticated users"
  on public.game_participants for select
  to authenticated
  using (true);

create policy "Users can RSVP themselves to games"
  on public.game_participants for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own RSVP"
  on public.game_participants for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can cancel their own RSVP"
  on public.game_participants for delete
  to authenticated
  using (auth.uid() = user_id);

-- ============================================================
-- TOURNAMENTS (read-only for authenticated users)
-- ============================================================
create policy "Tournaments are viewable by authenticated users"
  on public.tournaments for select
  to authenticated
  using (true);
