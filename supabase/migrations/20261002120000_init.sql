-- Tessera's backend, first cut: cloud saves, the Daily's results, and the
-- names players show on leaderboards.
--
-- Every table has row-level security on. A player can only ever read or
-- write their own save; Daily results are written by their owner and read
-- by everyone only through the functions at the bottom, which return
-- standings and names, never anyone's raw rows.

-- ---------------------------------------------------------------------------
-- Profiles: the name a player shows on leaderboards. Optional.
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(trim(display_name)) between 2 and 24),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "profiles: create own"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

create policy "profiles: rename own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Saves: one per player. The app's whole PlayerProgress and Settings, as
-- JSON, with a revision number so two devices cannot overwrite each other
-- without noticing (see `put_save`).
-- ---------------------------------------------------------------------------

create table public.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  progress jsonb not null,
  settings jsonb,
  revision integer not null default 1 check (revision >= 1),
  device text check (char_length(device) <= 64),
  updated_at timestamptz not null default now(),
  -- A save is a few tens of kilobytes; this stops anyone using it as storage.
  constraint saves_size check (pg_column_size(progress) < 512 * 1024)
);

alter table public.saves enable row level security;

create policy "saves: read own"
  on public.saves for select to authenticated
  using (user_id = auth.uid());

-- Writes go through `put_save` only, so the revision check cannot be skipped.

-- ---------------------------------------------------------------------------
-- Daily results: one per player per day - the first solve, timed.
-- ---------------------------------------------------------------------------

create table public.daily_results (
  user_id uuid not null references auth.users (id) on delete cascade,
  day_key date not null,
  game text not null check (char_length(game) <= 32),
  ms integer not null check (ms between 2000 and 86400000),
  stars smallint not null check (stars between 1 and 3),
  created_at timestamptz not null default now(),
  primary key (user_id, day_key)
);

create index daily_results_by_day on public.daily_results (day_key, ms);

alter table public.daily_results enable row level security;

-- Only today's Daily (UTC), or yesterday's for a solve that finished just
-- after midnight; never a past or future day, and never twice.
create policy "daily: submit own, today only"
  on public.daily_results for insert to authenticated
  with check (
    user_id = auth.uid()
    and day_key between (now() at time zone 'utc')::date - 1 and (now() at time zone 'utc')::date
  );

create policy "daily: read own"
  on public.daily_results for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Writes the caller's save if `base_revision` is the revision the device
-- last saw (0 for a device that has never synced and there is no save
-- yet). Otherwise writes nothing and returns the server's copy, so the
-- device can merge and try again.
create function public.put_save(p_progress jsonb, p_settings jsonb, p_base_revision integer, p_device text default null)
returns table (ok boolean, revision integer, progress jsonb, settings jsonb, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  current public.saves%rowtype;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select * into current from public.saves s where s.user_id = me for update;

  if not found then
    -- No save yet (or it was deleted): this one is the first.
    insert into public.saves (user_id, progress, settings, revision, device)
    values (me, p_progress, p_settings, 1, p_device);
    return query select true, 1, p_progress, p_settings, now();
    return;
  end if;

  if current.revision <> p_base_revision then
    return query select false, current.revision, current.progress, current.settings, current.updated_at;
    return;
  end if;

  update public.saves s
     set progress = p_progress,
         settings = p_settings,
         revision = current.revision + 1,
         device = p_device,
         updated_at = now()
   where s.user_id = me;
  return query select true, current.revision + 1, p_progress, p_settings, now();
end;
$$;

-- Where a time stands among everyone's on one day's Daily.
create function public.daily_standing(p_day date, p_ms integer)
returns table (players integer, faster_than numeric)
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer as players,
         case when count(*) <= 1 then 0
              else round(count(*) filter (where d.ms > p_ms)::numeric / (count(*) - 1), 3)
         end as faster_than
    from public.daily_results d
   where d.day_key = p_day;
$$;

-- The fastest on one day's Daily, with the names they chose (or none).
create function public.daily_leaderboard(p_day date, p_limit integer default 50)
returns table (place bigint, display_name text, ms integer, stars smallint, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  select rank() over (order by d.ms) as place,
         p.display_name,
         d.ms,
         d.stars,
         d.user_id = auth.uid() as is_me
    from public.daily_results d
    left join public.profiles p on p.id = d.user_id
   where d.day_key = p_day
   order by d.ms
   limit least(greatest(p_limit, 1), 100);
$$;

revoke all on function public.put_save(jsonb, jsonb, integer, text) from public, anon;
revoke all on function public.daily_standing(date, integer) from public, anon;
revoke all on function public.daily_leaderboard(date, integer) from public, anon;
grant execute on function public.put_save(jsonb, jsonb, integer, text) to authenticated;
grant execute on function public.daily_standing(date, integer) to authenticated;
grant execute on function public.daily_leaderboard(date, integer) to authenticated;
