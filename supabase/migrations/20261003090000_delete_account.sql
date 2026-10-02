-- Deleting an account, from inside the app: the player's sign-in, cloud
-- save, Daily results and leaderboard profile, all at once (the tables
-- reference auth.users with `on delete cascade`). Required by Apple for
-- any app that lets players create an account.

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
