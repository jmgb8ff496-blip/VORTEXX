insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', false, 10485760, array[
  'image/jpeg','image/png','image/webp','image/gif',
  'audio/webm','audio/mp4','audio/ogg','audio/mpeg','audio/x-m4a',
  'application/pdf','text/plain','application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy attachments_read on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and public.is_chat_member(((storage.foldername(name))[1])::uuid));
create policy attachments_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and public.is_chat_member(((storage.foldername(name))[1])::uuid));

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  chat_id uuid not null references public.chats(id) on delete cascade,
  path text not null,
  kind text not null check (kind in ('image','file','voice')),
  mime text not null,
  name text not null,
  size bigint not null check (size <= 10485760),
  duration_ms int check (duration_ms is null or duration_ms <= 600000),
  created_at timestamptz not null default now()
);
create index on public.attachments (message_id);
create index on public.attachments (chat_id);
alter table public.attachments enable row level security;
create policy attachments_select on public.attachments for select to authenticated
  using (public.is_chat_member(chat_id));
create policy attachments_insert on public.attachments for insert to authenticated
  with check (path like chat_id::text || '/%' and exists (
    select 1 from public.messages m
    where m.id = message_id and m.sender_id = auth.uid() and m.chat_id = attachments.chat_id));
grant select, insert on public.attachments to authenticated;
alter publication supabase_realtime add table public.attachments;
