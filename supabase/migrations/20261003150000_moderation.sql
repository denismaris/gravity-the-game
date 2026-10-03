-- Moderation for what players write that others can see: the name and the
-- city on the leaderboards.
--
--  1. A filter. `name_ok` refuses names and cities with slurs or obscene
--     words (English and Romanian), also when spelled with numbers or
--     symbols ("f4ck", "n1gg..."). The app runs the same list first, for a
--     friendly message (src/backend/nameFilter.ts - a test keeps the two
--     lists identical); this check is the one that cannot be skipped.
--  2. Reports. Any player can report another's name; three different
--     players reporting one name hides it everywhere - the boards show
--     the "Player 7B5F" stand-in and no city instead - until the reported
--     player changes it (a new name starts with a clean slate).
--  3. Hiding a player for yourself is kept on the phone (the app's own
--     list), so it needs nothing here.

-- ---------------------------------------------------------------------------
-- The filter
-- ---------------------------------------------------------------------------

-- Fragments refused anywhere inside a name, once lowercased, Romanian
-- letters folded to plain ones, look-alike digits and symbols read as the
-- letters they stand for, and every space and symbol removed. Only
-- fragments long or unusual enough not to sit inside an ordinary name.
create function public.blocked_fragments()
returns text[]
language sql
immutable
as $$
  select array[
    'fuck', 'fuk', 'fck', 'shit', 'cunt', 'bitch', 'nigg', 'niga', 'fagot', 'faggot', 'whore', 'slut',
    'rapist', 'hitler', 'porn', 'pussy', 'asshole', 'bastard', 'retard', 'molest', 'pedo', 'kkk',
    'pizda', 'futut', 'futui', 'tarfa', 'cacat', 'poponar', 'bulangiu', 'labagiu', 'jidan', 'muist', 'pulamea'
  ]::text[];
$$;

-- Words refused only when they stand on their own, because as fragments
-- they sit inside real names and places ("Cassandra", "Essex", "Dickens",
-- "Pula" the town is spelled the same as the word, so only a word alone).
create function public.blocked_words()
returns text[]
language sql
immutable
as $$
  select array[
    'ass', 'cum', 'sex', 'tit', 'tits', 'cock', 'dick', 'fag', 'rape', 'anal', 'nazi', 'jizz',
    'pula', 'muie', 'curva', 'coaie', 'futu', 'sugi', 'tigan', 'tigani'
  ]::text[];
$$;

-- Real places that happen to contain a blocked fragment - taken out of a
-- name before it is checked, so a player from Scunthorpe can say so.
create function public.allowed_words()
returns text[]
language sql
immutable
as $$
  select array['scunthorpe', 'penistone', 'clitheroe']::text[];
$$;

create function public.fold_name(p text)
returns text
language sql
immutable
as $$
  select regexp_replace(
           translate(lower(coalesce(p, '')), 'ăâîșşțţ013457@$!|', 'aaissttoieastasii'),
           '(' || array_to_string(public.allowed_words(), '|') || ')', ' ', 'g');
$$;

-- Whether a name (or city) may be shown to other players.
create function public.name_ok(p text)
returns boolean
language sql
immutable
as $$
  with f as (
    select public.fold_name(p) as t
  )
  select not exists (
           select 1 from f, unnest(public.blocked_fragments()) w
            where position(w in regexp_replace(f.t, '[^a-z]', '', 'g')) > 0
         )
     and not exists (
           select 1 from f, unnest(public.blocked_words()) w
            where f.t ~ ('(^|[^a-z])' || w || '($|[^a-z])')
         );
$$;

-- Enforced on every new or changed name and city. `not valid` leaves rows
-- written before the filter existed alone; they still pass through it the
-- next time they change.
alter table public.profiles
  add constraint profiles_name_ok check (display_name is null or public.name_ok(display_name)) not valid,
  add constraint profiles_city_ok check (city is null or public.name_ok(city)) not valid;

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------

create table public.reports (
  reporter uuid not null references auth.users (id) on delete cascade,
  target uuid not null references auth.users (id) on delete cascade,
  -- The name as it was reported: a new name is a clean slate.
  name text,
  created_at timestamptz not null default now(),
  primary key (reporter, target),
  check (reporter <> target)
);

-- No policies: nobody reads or writes this table directly. Reports go in
-- through `report_player`, and only the moderation check below reads them.
alter table public.reports enable row level security;

create function public.report_player(p_target uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.reports (reporter, target, name)
  select auth.uid(), p_target, p.display_name
    from public.profiles p
   where p.id = p_target
     and auth.uid() is not null
     and auth.uid() <> p_target
  on conflict (reporter, target) do update set name = excluded.name, created_at = now();
$$;

-- Whether a player's current name has been reported by three or more
-- different players.
create function public.name_hidden(p_id uuid, p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_name is not null
     and (select count(*) from public.reports r where r.target = p_id and r.name is not distinct from p_name) >= 3;
$$;

-- ---------------------------------------------------------------------------
-- The boards, again: now with each row's player (for Report and Hide in
-- the app) and with a hidden name shown as the stand-in, without a city.
-- ---------------------------------------------------------------------------

drop function public.daily_board(date, text, integer);
drop function public.xp_board(text, integer);

create function public.daily_board(p_day date, p_scope text default 'world', p_limit integer default 50)
returns table (place bigint, player uuid, display_name text, country text, city text, ms integer, stars smallint, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select p.country, p.city_key from public.profiles p where p.id = auth.uid()
  ), ranked as (
    select rank() over (order by d.ms) as place,
           d.user_id as player,
           board_name(case when name_hidden(d.user_id, p.display_name) then null else p.display_name end, d.user_id) as display_name,
           p.country,
           case when name_hidden(d.user_id, p.display_name) or not coalesce(name_ok(p.city), true) then null else p.city end as city,
           d.ms, d.stars,
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

create function public.xp_board(p_scope text default 'world', p_limit integer default 50)
returns table (place bigint, player uuid, display_name text, country text, city text, xp integer, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select p.country, p.city_key from public.profiles p where p.id = auth.uid()
  ), ranked as (
    select rank() over (order by p.xp desc) as place,
           p.id as player,
           board_name(case when name_hidden(p.id, p.display_name) then null else p.display_name end, p.id) as display_name,
           p.country,
           case when name_hidden(p.id, p.display_name) or not coalesce(name_ok(p.city), true) then null else p.city end as city,
           p.xp,
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

revoke all on function public.daily_board(date, text, integer) from public, anon;
revoke all on function public.xp_board(text, integer) from public, anon;
revoke all on function public.report_player(uuid) from public, anon;
revoke all on function public.name_hidden(uuid, text) from public, anon, authenticated;
grant execute on function public.daily_board(date, text, integer) to authenticated;
grant execute on function public.xp_board(text, integer) to authenticated;
grant execute on function public.report_player(uuid) to authenticated;
