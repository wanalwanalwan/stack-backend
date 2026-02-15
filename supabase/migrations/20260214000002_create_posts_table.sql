-- Create post_type enum and posts table for BeReal-style session posting

create type public.post_type as enum ('session_photo', 'session_clip');

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  post_type public.post_type not null default 'session_photo',
  caption text,
  media_url text not null,
  game_id uuid references public.games(id) on delete set null,
  tournament_id uuid references public.tournaments(id) on delete set null,
  location extensions.geography(point, 4326),
  location_name text,
  created_at timestamptz not null default now()
);

-- Indexes
create index idx_posts_user_id on public.posts (user_id);
create index idx_posts_created_at on public.posts (created_at desc);
create index idx_posts_location on public.posts using gist (location);

-- RLS
alter table public.posts enable row level security;

create policy "Authenticated users can view all posts"
  on public.posts for select
  to authenticated
  using (true);

create policy "Users can insert own posts"
  on public.posts for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can delete own posts"
  on public.posts for delete
  to authenticated
  using (auth.uid() = user_id);
