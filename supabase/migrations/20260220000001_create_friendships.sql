-- Friendship system: mutual friend requests with accept/decline

-- 1. Enum for friendship status
create type friendship_status as enum ('pending', 'accepted', 'declined');

-- 2. Friendships table
create table public.friendships (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references public.users(id) on delete cascade,
    friend_id   uuid not null references public.users(id) on delete cascade,
    status      friendship_status not null default 'pending',
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),

    -- No self-friendships
    constraint friendships_no_self check (user_id <> friend_id)
);

-- Only one row per unordered pair (unique index supports function expressions)
create unique index idx_friendships_unique_pair
    on public.friendships (least(user_id, friend_id), greatest(user_id, friend_id));

-- Indexes
create index idx_friendships_user_id   on public.friendships(user_id);
create index idx_friendships_friend_id on public.friendships(friend_id);
create index idx_friendships_status    on public.friendships(status);

-- Updated_at trigger
create trigger set_friendships_updated_at
    before update on public.friendships
    for each row
    execute function public.handle_updated_at();

-- 3. RLS
alter table public.friendships enable row level security;

-- Either party can view
create policy "friendships_select" on public.friendships
    for select using (auth.uid() in (user_id, friend_id));

-- Only requester can insert
create policy "friendships_insert" on public.friendships
    for insert with check (auth.uid() = user_id);

-- Only recipient can update (accept/decline)
create policy "friendships_update" on public.friendships
    for update using (auth.uid() = friend_id);

-- Either party can delete
create policy "friendships_delete" on public.friendships
    for delete using (auth.uid() in (user_id, friend_id));

-- 4. RPC: get accepted friends with profile info
create or replace function public.get_friends(p_user_id uuid)
returns table(
    friendship_id   uuid,
    friend_user_id  uuid,
    username        text,
    first_name      text,
    last_name       text,
    dupr_rating     double precision,
    avatar_url      text,
    status          friendship_status,
    created_at      timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
    -- I sent the request, they accepted
    select
        f.id            as friendship_id,
        u.id            as friend_user_id,
        u.username,
        u.first_name,
        u.last_name,
        u.dupr_rating,
        u.avatar_url,
        f.status,
        f.created_at
    from friendships f
    join users u on u.id = f.friend_id
    where f.user_id = p_user_id
      and f.status = 'accepted'

    union all

    -- They sent the request, I accepted
    select
        f.id            as friendship_id,
        u.id            as friend_user_id,
        u.username,
        u.first_name,
        u.last_name,
        u.dupr_rating,
        u.avatar_url,
        f.status,
        f.created_at
    from friendships f
    join users u on u.id = f.user_id
    where f.friend_id = p_user_id
      and f.status = 'accepted';
$$;

-- 5. RPC: get pending incoming friend requests
create or replace function public.get_friend_requests(p_user_id uuid)
returns table(
    friendship_id   uuid,
    friend_user_id  uuid,
    username        text,
    first_name      text,
    last_name       text,
    dupr_rating     double precision,
    avatar_url      text,
    status          friendship_status,
    created_at      timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
    select
        f.id            as friendship_id,
        u.id            as friend_user_id,
        u.username,
        u.first_name,
        u.last_name,
        u.dupr_rating,
        u.avatar_url,
        f.status,
        f.created_at
    from friendships f
    join users u on u.id = f.user_id
    where f.friend_id = p_user_id
      and f.status = 'pending';
$$;
