-- Trigger function to auto-update updated_at columns
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Users table linked to Supabase Auth
create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  dupr_id     text unique,
  dupr_rating numeric(3,2) check (dupr_rating >= 1.0 and dupr_rating <= 8.0),
  username    text unique not null,
  avatar_url  text,
  location    extensions.geography(point, 4326),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.users is 'App user profiles linked to Supabase Auth and DUPR ratings.';

create trigger users_updated_at
  before update on public.users
  for each row execute function public.handle_updated_at();
