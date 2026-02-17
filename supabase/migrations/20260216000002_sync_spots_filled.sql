-- One-time fix: sync spots_filled with actual confirmed participant count
update public.games g
set spots_filled = sub.confirmed_count
from (
  select game_id, count(*)::smallint as confirmed_count
  from public.game_participants
  where rsvp_status = 'confirmed'
  group by game_id
) sub
where g.id = sub.game_id
  and g.spots_filled <> sub.confirmed_count;
