create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text not null,
  bio text not null default '' check (char_length(bio) <= 200),
  avatar_url text,
  created_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_]{3,20}$')
);
create unique index profiles_username_key on public.profiles (lower(username));
alter table public.profiles enable row level security;
create policy "profiles_select" on public.profiles for select to authenticated using (true);
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name)
  values (new.id, lower(new.raw_user_meta_data->>'username'),
    coalesce(nullif(new.raw_user_meta_data->>'display_name',''), new.raw_user_meta_data->>'username'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.username_available(u text) returns boolean
language sql security definer set search_path = public stable as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(u))
$$;
grant execute on function public.username_available(text) to anon, authenticated;
