alter table public.chats
  add column title text check (title is null or char_length(title) between 1 and 100),
  add column description text not null default '' check (char_length(description) <= 500),
  add column is_public boolean not null default false,
  add column slug text,
  add column only_admins_post boolean not null default false,
  add column pinned_message_id uuid references public.messages(id) on delete set null,
  add column created_by uuid references public.profiles(id) on delete set null;
alter table public.chats drop constraint if exists chats_type_check;
alter table public.chats add constraint chats_type_check check (type in ('direct','group','channel'));
alter table public.chats add constraint chats_slug_format check (slug is null or slug ~ '^[a-z0-9_]{3,32}$');
create unique index chats_slug_key on public.chats (lower(slug)) where slug is not null;
alter table public.chat_members add column role text not null default 'member' check (role in ('owner','admin','member'));

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  code text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked boolean not null default false
);
alter table public.invitations enable row level security;

create function public.chat_type(cid uuid) returns text language sql security definer set search_path = public stable as $$
  select type from public.chats where id = cid $$;
create function public.my_role(cid uuid) returns text language sql security definer set search_path = public stable as $$
  select role from public.chat_members where chat_id = cid and user_id = auth.uid() $$;
create function public.is_chat_admin(cid uuid) returns boolean language sql security definer set search_path = public stable as $$
  select coalesce(public.my_role(cid) in ('owner','admin'), false) $$;
create function public.can_post(cid uuid) returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.chat_members cm join public.chats c on c.id = cm.chat_id
    where cm.chat_id = cid and cm.user_id = auth.uid() and (
      c.type = 'direct'
      or (c.type = 'group' and (not c.only_admins_post or cm.role in ('owner','admin')))
      or (c.type = 'channel' and cm.role in ('owner','admin')))) $$;
create function public.member_count(cid uuid) returns bigint language sql security definer set search_path = public stable as $$
  select case when public.is_chat_member(cid) then (select count(*) from public.chat_members where chat_id = cid) else 0 end $$;

drop policy members_select on public.chat_members;
create policy members_select on public.chat_members for select to authenticated using (
  user_id = auth.uid() or (public.is_chat_member(chat_id)
    and (public.chat_type(chat_id) <> 'channel' or public.is_chat_admin(chat_id))));
drop policy messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.can_post(chat_id) and char_length(btrim(body)) > 0);

create function public.create_chat(kind text, ttl text, descr text, pub boolean, slg text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); cid uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if kind not in ('group','channel') then raise exception 'invalid type'; end if;
  if char_length(btrim(coalesce(ttl,''))) < 1 then raise exception 'title required'; end if;
  if kind = 'channel' and coalesce(pub,false) and slg is null then raise exception 'slug required'; end if;
  insert into public.chats (type, title, description, is_public, slug, created_by, only_admins_post)
  values (kind, left(btrim(ttl),100), left(coalesce(descr,''),500), kind = 'channel' and coalesce(pub,false),
    case when kind = 'channel' and coalesce(pub,false) then lower(slg) else null end, me, kind = 'channel')
  returning id into cid;
  insert into public.chat_members (chat_id, user_id, role) values (cid, me, 'owner');
  return cid;
end $$;
create function public.get_invite(cid uuid) returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not public.is_chat_admin(cid) then raise exception 'forbidden'; end if;
  select code into c from public.invitations where chat_id = cid and not revoked order by created_at desc limit 1;
  if c is null then insert into public.invitations (chat_id, created_by) values (cid, auth.uid()) returning code into c; end if;
  return c;
end $$;
create function public.join_by_invite(code_in text) returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select i.chat_id into cid from public.invitations i join public.chats c on c.id = i.chat_id
    where i.code = code_in and not i.revoked and (i.expires_at is null or i.expires_at > now()) and c.type in ('group','channel');
  if cid is null then raise exception 'invalid invite'; end if;
  insert into public.chat_members (chat_id, user_id) values (cid, auth.uid()) on conflict do nothing;
  return cid;
end $$;
create function public.join_public_channel(slg text) returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select c.id into cid from public.chats c where c.type = 'channel' and c.is_public and lower(c.slug) = lower(slg);
  if cid is null then raise exception 'channel not found'; end if;
  insert into public.chat_members (chat_id, user_id) values (cid, auth.uid()) on conflict do nothing;
  return cid;
end $$;
create function public.channel_preview(slg text)
returns table (cid uuid, ctitle text, cdescr text, cmembers bigint, cis_member boolean)
language sql security definer set search_path = public stable as $$
  select c.id, c.title, c.description, (select count(*) from public.chat_members m where m.chat_id = c.id),
    exists (select 1 from public.chat_members m where m.chat_id = c.id and m.user_id = auth.uid())
  from public.chats c where c.type = 'channel' and c.is_public and lower(c.slug) = lower(slg) $$;
create function public.search_channels(q text)
returns table (cid uuid, ctitle text, cslug text, cdescr text, cmembers bigint)
language sql security definer set search_path = public stable as $$
  select c.id, c.title, c.slug, c.description, (select count(*) from public.chat_members m where m.chat_id = c.id)
  from public.chats c
  where c.type = 'channel' and c.is_public and auth.uid() is not null
    and (c.title ilike '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%'
      or c.slug ilike '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%')
  order by 5 desc limit 20 $$;
create function public.add_member(cid uuid, uid uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_chat_admin(cid) then raise exception 'forbidden'; end if;
  if public.chat_type(cid) = 'direct' then raise exception 'invalid chat'; end if;
  if not exists (select 1 from public.profiles where id = uid) then raise exception 'user not found'; end if;
  insert into public.chat_members (chat_id, user_id) values (cid, uid) on conflict do nothing;
end $$;
create function public.remove_member(cid uuid, uid uuid) returns void language plpgsql security definer set search_path = public as $$
declare tr text; mr text := public.my_role(cid);
begin
  if mr is null or mr not in ('owner','admin') then raise exception 'forbidden'; end if;
  select role into tr from public.chat_members where chat_id = cid and user_id = uid;
  if tr is null then return; end if;
  if tr = 'owner' then raise exception 'cannot remove owner'; end if;
  if tr = 'admin' and mr <> 'owner' then raise exception 'forbidden'; end if;
  delete from public.chat_members where chat_id = cid and user_id = uid;
end $$;
create function public.leave_chat(cid uuid) returns void language plpgsql security definer set search_path = public as $$
declare nxt uuid; r text;
begin
  select role into r from public.chat_members where chat_id = cid and user_id = auth.uid();
  if r is null then return; end if;
  if public.chat_type(cid) = 'direct' then raise exception 'cannot leave direct chat'; end if;
  delete from public.chat_members where chat_id = cid and user_id = auth.uid();
  if r = 'owner' then
    select user_id into nxt from public.chat_members where chat_id = cid order by (role = 'admin') desc, joined_at asc limit 1;
    if nxt is null then delete from public.chats where id = cid;
    else update public.chat_members set role = 'owner' where chat_id = cid and user_id = nxt; end if;
  end if;
end $$;
create function public.set_role(cid uuid, uid uuid, r text) returns void language plpgsql security definer set search_path = public as $$
begin
  if public.my_role(cid) is distinct from 'owner' then raise exception 'forbidden'; end if;
  if r not in ('admin','member') then raise exception 'invalid role'; end if;
  update public.chat_members set role = r where chat_id = cid and user_id = uid and role <> 'owner';
end $$;
create function public.update_chat(cid uuid, ttl text, descr text, onlyadm boolean) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_chat_admin(cid) then raise exception 'forbidden'; end if;
  if char_length(btrim(coalesce(ttl,''))) < 1 then raise exception 'title required'; end if;
  update public.chats set title = left(btrim(ttl),100), description = left(coalesce(descr,''),500),
    only_admins_post = case when type = 'channel' then true else coalesce(onlyadm,false) end
  where id = cid and type <> 'direct';
end $$;
create function public.pin_message(cid uuid, mid uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_chat_admin(cid) then raise exception 'forbidden'; end if;
  if mid is not null and not exists (select 1 from public.messages where id = mid and chat_id = cid) then raise exception 'message not found'; end if;
  update public.chats set pinned_message_id = mid where id = cid;
end $$;

revoke all on function public.chat_type(uuid), public.my_role(uuid), public.is_chat_admin(uuid), public.can_post(uuid), public.member_count(uuid),
  public.create_chat(text,text,text,boolean,text), public.get_invite(uuid), public.join_by_invite(text), public.join_public_channel(text),
  public.channel_preview(text), public.search_channels(text), public.add_member(uuid,uuid), public.remove_member(uuid,uuid),
  public.leave_chat(uuid), public.set_role(uuid,uuid,text), public.update_chat(uuid,text,text,boolean), public.pin_message(uuid,uuid) from public;
grant execute on function public.chat_type(uuid), public.my_role(uuid), public.is_chat_admin(uuid), public.can_post(uuid), public.member_count(uuid),
  public.create_chat(text,text,text,boolean,text), public.get_invite(uuid), public.join_by_invite(text), public.join_public_channel(text),
  public.channel_preview(text), public.search_channels(text), public.add_member(uuid,uuid), public.remove_member(uuid,uuid),
  public.leave_chat(uuid), public.set_role(uuid,uuid,text), public.update_chat(uuid,text,text,boolean), public.pin_message(uuid,uuid) to authenticated;
alter publication supabase_realtime add table public.chats;
