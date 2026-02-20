-- Fix: allow host to transfer ownership by updating creator_id
-- The old policy required auth.uid() = creator_id in WITH CHECK,
-- which blocked setting creator_id to a different user.

drop policy "Creators can update their own games" on public.games;

create policy "Creators can update their own games"
  on public.games for update
  to authenticated
  using (auth.uid() = creator_id)
  with check (true);
