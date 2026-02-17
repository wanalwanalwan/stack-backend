-- RPC to atomically increment spots_filled, bypassing RLS so any
-- authenticated user (not just the creator) can update the count
-- after passing business-rule checks in the edge function.
create or replace function public.increment_spots_filled(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update games
     set spots_filled = spots_filled + 1
   where id = p_game_id
     and spots_filled < spots_available;

  if not found then
    raise exception 'Failed to increment spots — game may be full or not found.';
  end if;
end;
$$;

-- Also create decrement version for cancel-rsvp
create or replace function public.decrement_spots_filled(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update games
     set spots_filled = spots_filled - 1
   where id = p_game_id
     and spots_filled > 0;

  if not found then
    raise exception 'Failed to decrement spots — game not found or already at zero.';
  end if;
end;
$$;
