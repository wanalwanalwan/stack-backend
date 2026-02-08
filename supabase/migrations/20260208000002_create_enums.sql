-- Game format: singles, doubles, mixed doubles, or drill
create type public.game_format as enum (
  'singles',
  'doubles',
  'mixed_doubles',
  'drill'
);

-- Player availability status
create type public.availability_status as enum (
  'available',
  'busy'
);

-- RSVP status for game participants
create type public.rsvp_status as enum (
  'confirmed',
  'waitlisted',
  'cancelled'
);
