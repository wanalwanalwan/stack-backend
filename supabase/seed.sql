-- Seed data for local development
-- These UUIDs are deterministic so they can be referenced across tables.

-- Insert test users into auth.users (Supabase Auth)
insert into auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
values
  ('a1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'alice@example.com', crypt('password123', gen_salt('bf')), now(), now(), now(), 'authenticated', 'authenticated'),
  ('b2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'bob@example.com',   crypt('password123', gen_salt('bf')), now(), now(), now(), 'authenticated', 'authenticated'),
  ('c3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'carol@example.com', crypt('password123', gen_salt('bf')), now(), now(), now(), 'authenticated', 'authenticated')
on conflict (id) do nothing;

-- App user profiles
-- Locations: Alice in Austin, Bob in Austin, Carol in Dallas
insert into public.users (id, dupr_id, dupr_rating, username, first_name, last_name, avatar_url, location) values
  ('a1111111-1111-1111-1111-111111111111', 'DUPR-1001', 3.75, 'alice_pickle',  'Alice',  'Johnson', null, extensions.st_setsrid(extensions.st_makepoint(-97.7431, 30.2672), 4326)::extensions.geography),
  ('b2222222-2222-2222-2222-222222222222', 'DUPR-1002', 4.20, 'bob_dinks',     'Bob',    'Smith',   null, extensions.st_setsrid(extensions.st_makepoint(-97.7500, 30.2700), 4326)::extensions.geography),
  ('c3333333-3333-3333-3333-333333333333', 'DUPR-1003', 3.50, 'carol_smash',   'Carol',  'Davis',   null, extensions.st_setsrid(extensions.st_makepoint(-96.7970, 32.7767), 4326)::extensions.geography);

-- Available players (Alice and Bob are available)
insert into public.available_players (id, user_id, status, available_until, location, preferred_format) values
  ('d4444444-4444-4444-4444-444444444444', 'a1111111-1111-1111-1111-111111111111', 'available', now() + interval '2 hours', extensions.st_setsrid(extensions.st_makepoint(-97.7431, 30.2672), 4326)::extensions.geography, 'doubles'),
  ('e5555555-5555-5555-5555-555555555555', 'b2222222-2222-2222-2222-222222222222', 'available', now() + interval '1 hour',  extensions.st_setsrid(extensions.st_makepoint(-97.7500, 30.2700), 4326)::extensions.geography, 'singles');

-- Games: doubles game, a drill, and a singles game
insert into public.games (id, creator_id, game_datetime, location, location_name, skill_level_min, skill_level_max, spots_available, spots_filled, game_format, description) values
  ('f6666666-6666-6666-6666-666666666666', 'a1111111-1111-1111-1111-111111111111', now() + interval '1 day',  extensions.st_setsrid(extensions.st_makepoint(-97.7431, 30.2672), 4326)::extensions.geography, 'Zilker Park Courts',       3.00, 4.50, 4, 1, 'doubles',  'Looking for 3 more for doubles at Zilker!'),
  ('a7777777-7777-7777-7777-777777777777', 'b2222222-2222-2222-2222-222222222222', now() + interval '2 days', extensions.st_setsrid(extensions.st_makepoint(-97.7500, 30.2700), 4326)::extensions.geography, 'Austin Rec Center',        3.00, 5.00, 8, 0, 'drill',    'Dinking drill session — all levels welcome'),
  ('b8888888-8888-8888-8888-888888888888', 'c3333333-3333-3333-3333-333333333333', now() + interval '3 days', extensions.st_setsrid(extensions.st_makepoint(-96.7970, 32.7767), 4326)::extensions.geography, 'Dallas Pickleball Complex', 4.00, 5.00, 2, 1, 'singles',  'Competitive singles match');

-- RSVPs: Bob confirmed for Alice's doubles game, Carol confirmed for her own singles game
insert into public.game_participants (game_id, user_id, rsvp_status) values
  ('f6666666-6666-6666-6666-666666666666', 'b2222222-2222-2222-2222-222222222222', 'confirmed'),
  ('b8888888-8888-8888-8888-888888888888', 'c3333333-3333-3333-3333-333333333333', 'confirmed');

-- Tournaments
insert into public.tournaments (id, name, location, location_name, start_date, end_date, skill_divisions, registration_url, description) values
  ('19999999-9999-9999-9999-999999999999', 'Austin Open Spring 2026', extensions.st_setsrid(extensions.st_makepoint(-97.7431, 30.2672), 4326)::extensions.geography, 'Austin Convention Center', '2026-04-15', '2026-04-17', '{3.0-3.5,3.5-4.0,4.0-4.5,4.5-5.0}', 'https://example.com/austin-open', 'Annual spring tournament in Austin. All skill levels.'),
  ('2aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'DFW Dink Classic',       extensions.st_setsrid(extensions.st_makepoint(-96.7970, 32.7767), 4326)::extensions.geography, 'Dallas Expo Center',       '2026-05-10', '2026-05-11', '{3.5-4.0,4.0-4.5,4.5-5.0,5.0+}',   'https://example.com/dfw-dink',    'Premier DFW tournament. Doubles and mixed doubles.');

-- Sample posts
insert into public.posts (id, user_id, post_type, caption, media_url, game_id, location, location_name) values
  ('3bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'a1111111-1111-1111-1111-111111111111', 'session_photo', 'Great doubles session at Zilker today!', 'https://example.com/photos/session1.jpg', 'f6666666-6666-6666-6666-666666666666', extensions.st_setsrid(extensions.st_makepoint(-97.7431, 30.2672), 4326)::extensions.geography, 'Zilker Park Courts'),
  ('4ccccccc-cccc-cccc-cccc-cccccccccccc', 'b2222222-2222-2222-2222-222222222222', 'session_clip',  'Working on my third shot drop', 'https://example.com/videos/drill1.mp4', null, extensions.st_setsrid(extensions.st_makepoint(-97.7500, 30.2700), 4326)::extensions.geography, 'Austin Rec Center');
