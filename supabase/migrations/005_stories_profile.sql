alter table public.profiles
  add column accent text not null default '#39E879' check (accent ~ '^#[0-9a-fA-F]{6}$'),
  add column bg_style text not null default 'default' check (bg_style in ('default','aurora','night','sunset','ocean')),
  add column last_seen timestamptz;

create table public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  show_online boolean not null default true,
  story_audience text not null default 'chats' check (story_audience in ('everyone','chats')),
  updated_at timestamptz not null default now()
);
alter table public.user_settings enable row level security;
create policy settings_select on public.user_settings for select to authenticated using (user_id = auth.uid());
create policy settings_insert on public.user_settings for insert to authenticated with check (user_id = auth.uid());
create policy settings_update on public.user_settings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.user_settings to authenticated;

create function public.touch_presence() returns void language sql security definer set search_path = public as $$
  update public.profiles p set last_seen = case
    when coalesce((select s.show_online from public.user_settings s where s.user_id = p.id), true) then now() else null end
  where p.id = auth.uid() $$;
create function public.shares_direct_chat(a uuid, b uuid) returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.chat_members x
    join public.chat_members y on y.chat_id = x.chat_id
    join public.chats c on c.id = x.chat_id
    where c.type = 'direct' and x.user_id = a and y.user_id = b) $$;

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_path text not null,
  media_kind text not null check (media_kind in ('image','video')),
  mime text not null,
  caption text not null default '' check (char_length(caption) <= 300),
  audience text not null default 'chats' check (audience in ('everyone','chats')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);
create index on public.stories (user_id, created_at desc);
create index on public.stories (expires_at);
create table public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);
alter table public.stories enable row level security;
alter table public.story_views enable row level security;

create function public.can_see_story(sid uuid) returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.stories s where s.id = sid and (s.user_id = auth.uid()
    or (s.expires_at > now() and (s.audience = 'everyone' or public.shares_direct_chat(s.user_id, auth.uid()))))) $$;
revoke all on function public.touch_presence(), public.shares_direct_chat(uuid,uuid), public.can_see_story(uuid) from public;
grant execute on function public.touch_presence(), public.shares_direct_chat(uuid,uuid), public.can_see_story(uuid) to authenticated;

create policy stories_select on public.stories for select to authenticated using (
  user_id = auth.uid() or (expires_at > now() and (audience = 'everyone' or public.shares_direct_chat(user_id, auth.uid()))));
create policy stories_insert on public.stories for insert to authenticated
  with check (user_id = auth.uid() and media_path like auth.uid()::text || '/%');
create policy stories_delete on public.stories for delete to authenticated using (user_id = auth.uid());
grant select, delete on public.stories to authenticated;
grant insert (user_id, media_path, media_kind, mime, caption, audience) on public.stories to authenticated;
create policy views_select on public.story_views for select to authenticated using (
  viewer_id = auth.uid() or exists (select 1 from public.stories s where s.id = story_id and s.user_id = auth.uid()));
create policy views_insert on public.story_views for insert to authenticated
  with check (viewer_id = auth.uid() and public.can_see_story(story_id));
grant select, insert on public.story_views to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp']),
  ('stories', 'stories', false, 31457280, array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy avatars_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy stories_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'stories' and (storage.foldername(name))[1] = auth.uid()::text);
create policy stories_remove on storage.objects for delete to authenticated
  using (bucket_id = 'stories' and (storage.foldername(name))[1] = auth.uid()::text);
create policy stories_read on storage.objects for select to authenticated
  using (bucket_id = 'stories' and exists (select 1 from public.stories s where s.media_path = name and public.can_see_story(s.id)));
