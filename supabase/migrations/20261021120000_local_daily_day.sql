-- The Daily now turns over at the player's own midnight, not UTC's: a day
-- key is the player's local calendar date. Somewhere on Earth that date is
-- already tomorrow by UTC (up to UTC+14), and somewhere it is still
-- yesterday (down to UTC-12), so a time is accepted for any date within a
-- day of UTC's either side - still never an older or later day than any
-- clock could show, and still once per day per player.

drop policy if exists "daily: submit own, today only" on public.daily_results;

create policy "daily: submit own, today only"
  on public.daily_results for insert to authenticated
  with check (
    user_id = auth.uid()
    and day_key between (now() at time zone 'utc')::date - 1 and (now() at time zone 'utc')::date + 1
  );
