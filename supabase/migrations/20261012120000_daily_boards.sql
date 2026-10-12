-- ---------------------------------------------------------------------------
-- A Daily board for newcomers, too.
--
-- A player whose games are still arriving does not always get the world's
-- Daily: on a day it falls on a game they have not met yet, they play a
-- Daily of their own, from the games they know. Those times were never
-- posted (they cannot be compared with the world's), so a new player did
-- not appear on any board at all. Now every Daily is posted, with the
-- board it belongs to: null for the world's Daily, or the puzzle's own id
-- for a newcomer's - and newcomers on the same board played the very same
-- puzzle, so their times are compared only with each other's.
--
-- Run after 20261003150000_moderation.sql.
-- ---------------------------------------------------------------------------

alter table public.daily_results
  add column if not exists board text check (board is null or char_length(board) <= 64);

create index if not exists daily_results_by_board on public.daily_results (day_key, board, ms);

-- Where a time stands among everyone's on one board of one day's Daily.
drop function if exists public.daily_standing(date, integer);
create function public.daily_standing(p_day date, p_ms integer, p_board text default null)
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
   where d.day_key = p_day
     and d.board is not distinct from p_board;
$$;

-- One board of one day's Daily, fastest first, within a scope.
drop function if exists public.daily_board(date, text, integer);
create function public.daily_board(p_day date, p_scope text default 'world', p_limit integer default 50, p_board text default null)
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
       and d.board is not distinct from p_board
       and in_scope(p_scope, p.country, p.city_key, me.country, me.city_key)
  )
  select * from ranked
   where place <= least(greatest(p_limit, 1), 100) or is_me
   order by place;
$$;

revoke all on function public.daily_standing(date, integer, text) from public, anon;
revoke all on function public.daily_board(date, text, integer, text) from public, anon;
grant execute on function public.daily_standing(date, integer, text) to authenticated;
grant execute on function public.daily_board(date, text, integer, text) to authenticated;
