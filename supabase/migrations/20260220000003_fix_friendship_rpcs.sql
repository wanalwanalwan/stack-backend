-- Fix: PostgREST schema cache doesn't find RPCs with custom enum return types.
-- Change status return type from friendship_status to text.

drop function if exists public.get_friends(uuid);
drop function if exists public.get_friend_requests(uuid);

create or replace function public.get_friends(p_user_id uuid)
returns table(
    friendship_id   uuid,
    friend_user_id  uuid,
    username        text,
    first_name      text,
    last_name       text,
    dupr_rating     double precision,
    avatar_url      text,
    status          text,
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
        f.status::text,
        f.created_at
    from friendships f
    join users u on u.id = f.friend_id
    where f.user_id = p_user_id
      and f.status = 'accepted'

    union all

    select
        f.id            as friendship_id,
        u.id            as friend_user_id,
        u.username,
        u.first_name,
        u.last_name,
        u.dupr_rating,
        u.avatar_url,
        f.status::text,
        f.created_at
    from friendships f
    join users u on u.id = f.user_id
    where f.friend_id = p_user_id
      and f.status = 'accepted';
$$;

create or replace function public.get_friend_requests(p_user_id uuid)
returns table(
    friendship_id   uuid,
    friend_user_id  uuid,
    username        text,
    first_name      text,
    last_name       text,
    dupr_rating     double precision,
    avatar_url      text,
    status          text,
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
        f.status::text,
        f.created_at
    from friendships f
    join users u on u.id = f.user_id
    where f.friend_id = p_user_id
      and f.status = 'pending';
$$;
