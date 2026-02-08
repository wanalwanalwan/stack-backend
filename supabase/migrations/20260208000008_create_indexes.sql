-- Spatial indexes (GIST) for location-based queries
create index idx_users_location on public.users using gist (location);
create index idx_available_players_location on public.available_players using gist (location);
create index idx_games_location on public.games using gist (location);
create index idx_tournaments_location on public.tournaments using gist (location);

-- Temporal indexes
create index idx_available_players_until on public.available_players (available_until);
create index idx_games_datetime on public.games (game_datetime);
create index idx_tournaments_start_date on public.tournaments (start_date);

-- Foreign key indexes
create index idx_available_players_user_id on public.available_players (user_id);
create index idx_games_creator_id on public.games (creator_id);
create index idx_game_participants_game_id on public.game_participants (game_id);
create index idx_game_participants_user_id on public.game_participants (user_id);

-- Partial index: only non-cancelled future games
create index idx_active_future_games on public.games (game_datetime)
  where is_cancelled = false;
