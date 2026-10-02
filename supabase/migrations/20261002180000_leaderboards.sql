-- Leaderboards by place: the world, a country, a city.
--
-- A player's country comes from their phone's region (they can change
-- it); their city is their own choice and optional. Nothing here is
-- tracked: it is what the player says, used only to group boards.
--
-- Two boards: today's Daily (fastest first) and all-time experience. Both
-- are read only through the functions below, which return names, places
-- and scores - never anyone's raw rows.

alter table public.profiles
  add column country text check (country ~ '^[A-Z]{2}$'),
  add column city text check (char_length(btrim(city)) between 2 and 40),
  -- How cities group: "Bucharest", " bucharest " and "BUCHAREST" are one.
  add column city_key text generated always as (lower(btrim(city))) stored,
  add column xp integer not null default 0 check (xp >= 0),
  add column updated_at timestamptz not null default now();

create index profiles_by_country on public.profiles (country, xp desc);
create index profiles_by_city on public.profiles (country, city_key, xp desc);

-- What a player is called on a board: their chosen name, or a stable
-- stand-in made from their id.
create function public.board_name(p_name text, p_id uuid)
returns text
language sql
immutable
as $$
  select coalesce(nullif(btrim(p_name), ''), 'Player ' || upper(substr(replace(p_id::text, '-', ''), 1, 4)));
$$;

-- Whether a profile falls inside a scope, as seen from the caller's own.
create function public.in_scope(p_scope text, p_country text, p_city_key text, p_my_country text, p_my_city_key text)
returns boolean
language sql
immutable
as $$
  select case p_scope
    when 'world' then true
    when 'country' then p_my_country is not null and p_country = p_my_country
    when 'city' then p_my_city_key is not null and p_country = p_my_country and p_city_key = p_my_city_key
    else false
  end;
$$;

-- Today's Daily, fastest first, within a scope: the top `p_limit`, and the
-- caller's own row too when they are further down.
create function public.daily_board(p_day date, p_scope text default 'world', p_limit integer default 50)
returns table (place bigint, display_name text, country text, city text, ms integer, stars smallint, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select p.country, p.city_key from public.profiles p where p.id = auth.uid()
  ), ranked as (
    select rank() over (order by d.ms) as place,
           board_name(p.display_name, d.user_id) as display_name,
           p.country, p.city, d.ms, d.stars,
           d.user_id = auth.uid() as is_me
      from public.daily_results d
      left join public.profiles p on p.id = d.user_id
      left join me on true
     where d.day_key = p_day
       and in_scope(p_scope, p.country, p.city_key, me.country, me.city_key)
  )
  select * from ranked
   where place <= least(greatest(p_limit, 1), 100) or is_me
   order by place;
$$;

-- All-time experience, highest first, within a scope - with the caller's
-- own row when they are further down.
create function public.xp_board(p_scope text default 'world', p_limit integer default 50)
returns table (place bigint, display_name text, country text, city text, xp integer, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select p.country, p.city_key from public.profiles p where p.id = auth.uid()
  ), ranked as (
    select rank() over (order by p.xp desc) as place,
           board_name(p.display_name, p.id) as display_name,
           p.country, p.city, p.xp,
           p.id = auth.uid() as is_me
      from public.profiles p
      left join me on true
     where p.xp > 0
       and in_scope(p_scope, p.country, p.city_key, me.country, me.city_key)
  )
  select * from ranked
   where place <= least(greatest(p_limit, 1), 100) or is_me
   order by place;
$$;

-- The cities players in one country have already chosen, most popular
-- first - offered as suggestions, so one city is not spelled five ways.
create function public.cities_in(p_country text, p_limit integer default 20)
returns table (city text, players bigint)
language sql
stable
security definer
set search_path = public
as $$
  select min(p.city) as city, count(*) as players
    from public.profiles p
   where p.country = p_country and p.city_key is not null
   group by p.city_key
   order by count(*) desc, min(p.city)
   limit least(greatest(p_limit, 1), 50);
$$;

revoke all on function public.daily_board(date, text, integer) from public, anon;
revoke all on function public.xp_board(text, integer) from public, anon;
revoke all on function public.cities_in(text, integer) from public, anon;
grant execute on function public.daily_board(date, text, integer) to authenticated;
grant execute on function public.xp_board(text, integer) to authenticated;
grant execute on function public.cities_in(text, integer) to authenticated;
