-- C-Diary update 004: case documents with AI summaries.
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Running it twice does no harm.

-- ---------- Private file storage (one folder per firm) ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('matter-docs', 'matter-docs', false, 26214400)  -- 25 MB per file
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- Files live at <firm id>/<matter id>/<file>. People can only reach their own firm's folder.
drop policy if exists "matter docs read" on storage.objects;
create policy "matter docs read" on storage.objects for select to authenticated
  using (bucket_id = 'matter-docs' and (storage.foldername(name))[1] = public.my_firm_id()::text);

drop policy if exists "matter docs upload" on storage.objects;
create policy "matter docs upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'matter-docs' and (storage.foldername(name))[1] = public.my_firm_id()::text);

drop policy if exists "matter docs delete" on storage.objects;
create policy "matter docs delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'matter-docs'
    and (storage.foldername(name))[1] = public.my_firm_id()::text
    and (owner_id = auth.uid()::text or public.my_role() in ('admin', 'partner'))
  );

-- ---------- Documents ----------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  matter_id uuid not null references public.matters (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 300),
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles (id) on delete set null,
  summary text,
  summary_status text not null default 'none' check (summary_status in ('none', 'working', 'done', 'failed')),
  summary_error text,
  summary_model text,
  summarized_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists documents_matter_idx on public.documents (matter_id, created_at desc);

create or replace function public.stamp_document() returns trigger
language plpgsql set search_path = public as $$
begin
  new.firm_id := public.my_firm_id();
  new.uploaded_by := auth.uid();
  new.created_at := now();
  new.summary := null;
  new.summary_status := 'none';
  return new;
end $$;

drop trigger if exists documents_stamp on public.documents;
create trigger documents_stamp before insert on public.documents
for each row execute function public.stamp_document();

-- Record uploads and deletions in the activity log.
create or replace function public.audit_document() returns trigger
language plpgsql security definer set search_path = public as $$
declare m_title text;
begin
  select title into m_title from matters where id = coalesce(new.matter_id, old.matter_id);
  if tg_op = 'INSERT' then
    perform log_activity(new.firm_id, 'uploaded', 'document', new.id,
      person_name(auth.uid()) || ' uploaded "' || new.name || '" to ' || coalesce(m_title, 'a matter'));
  elsif tg_op = 'DELETE' then
    perform log_activity(old.firm_id, 'deleted', 'document', old.id,
      person_name(auth.uid()) || ' deleted "' || old.name || '" from ' || coalesce(m_title, 'a matter'));
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists documents_audit on public.documents;
create trigger documents_audit after insert or delete on public.documents
for each row execute function public.audit_document();

alter table public.documents enable row level security;

-- Everyone in the firm sees a matter's documents while the matter is not archived.
drop policy if exists documents_read on public.documents;
create policy documents_read on public.documents for select to authenticated
  using (firm_id = public.my_firm_id() and exists (select 1 from public.matters m where m.id = matter_id));

drop policy if exists documents_insert on public.documents;
create policy documents_insert on public.documents for insert to authenticated
  with check (
    firm_id = public.my_firm_id()
    and uploaded_by = auth.uid()
    and exists (select 1 from public.matters m where m.id = matter_id and m.firm_id = public.my_firm_id())
    and (storage_path like public.my_firm_id()::text || '/%')
  );

-- The uploader, partners and admins can delete. (Summaries are saved by the server.)
drop policy if exists documents_delete on public.documents;
create policy documents_delete on public.documents for delete to authenticated
  using (firm_id = public.my_firm_id() and (uploaded_by = auth.uid() or public.my_role() in ('admin', 'partner')));
