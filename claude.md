# Stack - Pickleball Social Network

## Overview
Stack is a social network for pickleball players to find games, partners, and tournaments based on skill level (DUPR rating).

## MVP Core Features (Phase 1)
1. **Available Players** - See who's looking to play right now
2. **Available Games** - Browse open games/sessions
3. **Tournaments** - Discover local tournaments
4. **DUPR Integration** - All content gated by verified DUPR rating

## Target Users
- Recreational pickleball players (3.0-4.5 skill level)
- Tournament players looking for practice partners
- Players new to an area seeking games

## Tech Stack
- **iOS:** Swift + SwiftUI
- **Backend:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth + DUPR OAuth (if available)
- **Rating System:** DUPR API integration

## Key Differentiators
- **DUPR-gated content** - ensures skill-matched games
- **Real-time availability** - see who's playing NOW
- **Simple, focused** - no social feed bloat, just finding games

## Database Schema (Core Tables)

### users
- id, dupr_id, dupr_rating, username, location, avatar_url

### available_players
- id, user_id, status (available/busy), available_until, location, preferred_format

### games
- id, creator_id, game_datetime, location, skill_level_min, skill_level_max, spots_available, game_format

### tournaments
- id, name, location, start_date, skill_divisions, registration_url

### game_participants
- id, game_id, user_id, rsvp_status

## MVP User Flows

### 1. New User Onboarding
1. Sign up with email
2. Connect DUPR account (OAuth)
3. Verify DUPR rating imported
4. Set availability preferences
5. See nearby available players/games

### 2. Finding a Game
1. Open app → see nearby "Available Now" players
2. Filter by skill level (±0.5 from your rating)
3. See open games in next 24 hours
4. RSVP to a game
5. Get confirmation + location details

### 3. Posting Availability
1. Tap "I'm available to play"
2. Set duration (30 min, 1 hour, 2 hours)
3. Choose preferred format (singles/doubles)
4. Show on map for others to see

### 4. Creating a Game
1. Tap "Create Game"
2. Set date/time, location, skill level range
3. Post to feed
4. Receive RSVP notifications
5. Confirm participants

## DUPR Integration Requirements

### What we need from DUPR:
- **OAuth login** - users authenticate via DUPR
- **Rating sync** - pull current DUPR rating
- **Rating updates** - refresh periodically (daily?)
- **Verification** - confirm user owns DUPR profile

### API Endpoints (hypothetical):
```
GET /api/v1/users/:dupr_id/rating
GET /api/v1/users/:dupr_id/profile
POST /oauth/authorize
```

### Fallback if no API:
- Manual DUPR ID entry
- Screenshot verification (manual review)
- Self-reported with community validation

## Out of Scope for MVP
- ❌ Social feed / posts
- ❌ Messaging (use phone numbers for now)
- ❌ Court reviews
- ❌ Match history tracking
- ❌ Leaderboards
- ❌ Video content
- ❌ Equipment reviews

## Success Metrics (MVP)
- 100 users in first month
- 50 games created per week
- 70% of games fill all spots
- <10 second app load time
- Zero DUPR verification fraud

## Known Challenges
1. **DUPR API access** - need to reach out to DUPR for partnership/API
2. **Location accuracy** - ensure nearby players are actually nearby
3. **Ghost RSVPs** - players who RSVP but don't show up
4. **Skill inflation** - players claiming higher ratings than reality

## Development Phases

### Phase 1: MVP (Weeks 1-4)
- [ ] User auth + DUPR integration
- [ ] Available players list
- [ ] Create/browse games
- [ ] RSVP system
- [ ] Basic tournament listings

### Phase 2: Polish (Weeks 5-6)
- [ ] Push notifications
- [ ] Map view of players/games
- [ ] Profile photos
- [ ] Location filters

### Phase 3: Launch (Week 7)
- [ ] Beta testing with 20 users
- [ ] Bug fixes
- [ ] App Store submission

## Technical Decisions

### Why Supabase?
- Real-time subscriptions (see available players update live)
- Row Level Security (users can only edit their own data)
- PostgreSQL (proper relational data)
- Fast to build with

### Why DUPR-gated?
- Solves biggest pain point: skill mismatches
- Differentiates from generic social apps
- Builds trust in community
- Natural virality (players tell DUPR-verified friends)

### Why iOS-first?
- Faster development (one platform)
- Pickleball demographic skews iOS
- Can add Android later if successful

## Design Principles
1. **Fast** - Open app → see available players in <3 seconds
2. **Simple** - Every screen has one clear purpose
3. **Trust** - DUPR verification visible everywhere
4. **Local** - Focus on nearby players (5-20 mile radius)

## Questions to Resolve
- [ ] Can we get DUPR API access?
- [ ] What's the DUPR OAuth flow?
- [ ] How often should we refresh ratings?
- [ ] Should we allow non-DUPR users? (No for MVP)
- [ ] How to handle players without smartphones at courts?

## Contact
- **Repo:** github.com/wanalwanalwan/stack-ios
- **Backend:** github.com/wanalwanalwan/stack-backend
- **Team:** You + Co-founder

---

*Last updated: Feb 6, 2026*
