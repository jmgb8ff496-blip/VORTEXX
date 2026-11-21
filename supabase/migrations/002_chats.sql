create table public.chats (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'direct' check (type in ('direct','group')),
  created_at timestamptz not null default now()
);
create table public.chat_members (
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);
create index on public.chat_members (user_id);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) <= 4000),
  reply_to uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index on public.messages (chat_id, created_at desc);
create table public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) <= 8),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create function public.is_chat_member(cid uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.chat_members where chat_id = cid and user_id = auth.uid())
$$;
create function public.is_message_member(mid uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.messages m join public.chat_members cm on cm.chat_id = m.chat_id
                 where m.id = mid and cm.user_id = auth.uid())
$$;
create function public.start_direct_chat(other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); cid uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if other is null or other = me then raise exception 'invalid user'; end if;
  if not exists (select 1 from public.profiles where id = other) then raise exception 'user not found'; end if;
  select c.id into cid from public.chats c
    join public.chat_members a on a.chat_id = c.id and a.user_id = me
    join public.chat_members b on b.chat_id = c.id and b.user_id = other
    where c.type = 'direct' limit 1;
  if cid is null then
    insert into public.chats (type) values ('direct') returning id into cid;
    insert into public.chat_members (chat_id, user_id) values (cid, me), (cid, other);
  end if;
  return cid;
end $$;
create function public.mark_chat_read(cid uuid) returns void
language sql security definer set search_path = public as $$
  update public.chat_members set last_read_at = now() where chat_id = cid and user_id = auth.uid()
$$;
revoke all on function public.start_direct_chat(uuid), public.mark_chat_read(uuid) from public;
grant execute on function public.is_chat_member(uuid), public.is_message_member(uuid),
  public.start_direct_chat(uuid), public.mark_chat_read(uuid) to authenticated;

alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
create policy chats_select on public.chats for select to authenticated using (public.is_chat_member(id));
create policy members_select on public.chat_members for select to authenticated using (public.is_chat_member(chat_id));
create policy messages_select on public.messages for select to authenticated using (public.is_chat_member(chat_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_chat_member(chat_id) and char_length(btrim(body)) > 0);
create policy messages_update on public.messages for update to authenticated
  using (sender_id = auth.uid()) with check (sender_id = auth.uid());
create policy reactions_select on public.message_reactions for select to authenticated using (public.is_message_member(message_id));
create policy reactions_insert on public.message_reactions for insert to authenticated
  with check (user_id = auth.uid() and public.is_message_member(message_id));
create policy reactions_delete on public.message_reactions for delete to authenticated using (user_id = auth.uid());

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.chats, public.chat_members to authenticated;
grant select, insert on public.messages to authenticated;
grant update (body, edited_at, deleted_at) on public.messages to authenticated;
grant select, insert, delete on public.message_reactions to authenticated;
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);

alter publication supabase_realtime add table public.messages, public.chat_members;
