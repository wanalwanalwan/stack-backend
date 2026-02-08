# Stack Backend

Supabase backend for the Stack pickleball social network. Handles user profiles, game/drill creation, player availability, RSVP, and tournament listings — all gated by DUPR skill ratings.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for local Supabase)
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) v2.x
- [Deno](https://deno.land/) (for Edge Functions)

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/wanalwanalwan/stack-backend.git
cd stack-backend

# 2. Copy environment variables
cp .env.example .env

# 3. Start local Supabase (runs Postgres, Auth, Storage, etc. in Docker)
supabase start

# 4. Apply migrations and seed data
supabase db reset

# 5. Serve Edge Functions locally
supabase functions serve
```

After `supabase start`, your local endpoints are:

| Service      | URL                           |
|--------------|-------------------------------|
| API          | http://localhost:54321        |
| Studio       | http://localhost:54323        |
| Inbucket     | http://localhost:54324        |
| Database     | postgresql://postgres:postgres@localhost:54322/postgres |

## Project Structure

```
supabase/
├── config.toml                              # Supabase project config
├── migrations/
│   ├── 20260208000001_enable_extensions.sql  # PostGIS
│   ├── 20260208000002_create_enums.sql       # game_format, availability_status, rsvp_status
│   ├── 20260208000003_create_users_table.sql # Users + DUPR ratings
│   ├── 20260208000004_create_available_players_table.sql
│   ├── 20260208000005_create_games_table.sql # Games + drills
│   ├── 20260208000006_create_game_participants_table.sql
│   ├── 20260208000007_create_tournaments_table.sql
│   ├── 20260208000008_create_indexes.sql     # Spatial, temporal, FK indexes
│   ├── 20260208000009_enable_rls_policies.sql
│   └── 20260208000010_create_utility_functions.sql  # nearby_games(), etc.
├── seed.sql                                 # Test data (3 users, games, tournaments)
└── functions/
    ├── _shared/
    │   ├── cors.ts                          # CORS headers
    │   └── supabase-client.ts               # Client factories
    ├── rsvp-to-game/
    │   └── index.ts                         # RSVP with validation
    └── cleanup-expired-availability/
        └── index.ts                         # Remove stale availability
```

## Database Schema

**Core tables:** `users`, `available_players`, `games`, `game_participants`, `tournaments`

- Drills are games with `game_format = 'drill'`
- All locations use PostGIS `geography(POINT, 4326)` for radius queries in miles
- DUPR ratings stored as `numeric(3,2)` with CHECK constraints (1.0-8.0)
- RLS enabled on all tables — authenticated access only, users modify their own data

## RPC Functions

Call via `supabase.rpc()`:

| Function | Parameters | Description |
|----------|-----------|-------------|
| `nearby_games` | `lat`, `lng`, `radius_miles` | Games within radius, future + not cancelled |
| `nearby_available_players` | `lat`, `lng`, `radius_miles` | Available players with user details |
| `games_for_skill_level` | `rating` | Games matching a DUPR rating |
| `cleanup_expired_availability` | — | Deletes expired availability rows |

## Edge Functions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/rsvp-to-game` | POST | RSVP to a game (validates skill range, capacity, cancellation) |
| `/cleanup-expired-availability` | POST | Clean up expired availability entries |

### RSVP Example

```bash
curl -X POST http://localhost:54321/functions/v1/rsvp-to-game \
  -H "Authorization: Bearer <user-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"game_id": "f6666666-6666-6666-6666-666666666666"}'
```

## Test Accounts (Local Dev)

| Email | Password | Username | DUPR |
|-------|----------|----------|------|
| alice@example.com | password123 | alice_pickle | 3.75 |
| bob@example.com | password123 | bob_dinks | 4.20 |
| carol@example.com | password123 | carol_smash | 3.50 |

## Common Commands

```bash
supabase start          # Start local Supabase
supabase stop           # Stop local Supabase
supabase db reset       # Re-run migrations + seed
supabase db diff        # Generate migration from schema changes
supabase functions serve # Serve Edge Functions locally
supabase migration new <name>  # Create new migration file
```
