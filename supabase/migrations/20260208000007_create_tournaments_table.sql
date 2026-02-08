-- Tournament listings
create table public.tournaments (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  location         extensions.geography(point, 4326),
  location_name    text,
  start_date       date not null,
  end_date         date,
  skill_divisions  text[] not null default '{}',
  registration_url text,
  description      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.tournaments is 'Local tournament listings with skill division info.';

create trigger tournaments_updated_at
  before update on public.tournaments
  for each row execute function public.handle_updated_at();
