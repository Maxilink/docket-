-- C-Diary update 005: documents per hearing, "bring to court" checklists, and the morning cause list.
-- Run AFTER 004. Supabase: SQL Editor > New query > paste everything > Run. Running it twice does no harm.

-- ---------- Documents can belong to a hearing ----------
alter table public.documents add column if not exists event_id uuid references public.events (id) on delete set null;
create index if not exists documents_event_idx on public.documents (event_id) where event_id is not null;

-- A hearing's document must belong to the same matter.
create or replace function public.check_document_event() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.event_id is not null and not exists (
    select 1 from events e where e.id = new.event_id and e.matter_id = new.matter_id and e.firm_id = new.firm_id
  ) then
    raise exception 'That hearing belongs to a different matter.';
  end if;
  return new;
end $$;
drop trigger if exists documents_event_check on public.documents;
create trigger documents_event_check before insert or update of event_id on public.documents
for each row execute function public.check_document_event();

-- Staff can tag an existing document to a hearing (only that column is meant to change from the app).
drop policy if exists documents_update on public.documents;
create policy documents_update on public.documents for update to authenticated
  using (firm_id = public.my_firm_id() and exists (select 1 from public.matters m where m.id = matter_id))
  with check (firm_id = public.my_firm_id());

create or replace function public.guard_document_update() returns trigger
language plpgsql set search_path = public as $$
begin
  -- The server (service role) saves summaries; people may only move a document between hearings.
  if auth.uid() is not null and (
    new.name is distinct from old.name or new.storage_path is distinct from old.storage_path
    or new.matter_id is distinct from old.matter_id or new.firm_id is distinct from old.firm_id
    or new.uploaded_by is distinct from old.uploaded_by or new.summary is distinct from old.summary
    or new.summary_status is distinct from old.summary_status
  ) then
    raise exception 'Only the hearing a document belongs to can be changed.';
  end if;
  return new;
end $$;
drop trigger if exists documents_guard on public.documents;
create trigger documents_guard before update on public.documents
for each row execute function public.guard_document_update();

-- ---------- "Bring to court" checklist per hearing ----------
create table if not exists public.hearing_items (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 200),
  document_id uuid references public.documents (id) on delete set null,
  done boolean not null default false,
  done_by uuid references public.profiles (id) on delete set null,
  done_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists hearing_items_event_idx on public.hearing_items (event_id, created_at);

create or replace function public.stamp_hearing_item() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.firm_id := public.my_firm_id();
    new.created_by := auth.uid();
    new.created_at := now();
  else
    new.firm_id := old.firm_id;
    new.event_id := old.event_id;
  end if;
  if new.done and (tg_op = 'INSERT' or not old.done) then
    new.done_by := auth.uid(); new.done_at := now();
  elsif not new.done then
    new.done_by := null; new.done_at := null;
  end if;
  return new;
end $$;
drop trigger if exists hearing_items_stamp on public.hearing_items;
create trigger hearing_items_stamp before insert or update on public.hearing_items
for each row execute function public.stamp_hearing_item();

alter table public.hearing_items enable row level security;

-- Anyone in the firm can see and work on a hearing's checklist while the hearing is not archived.
drop policy if exists hearing_items_read on public.hearing_items;
create policy hearing_items_read on public.hearing_items for select to authenticated
  using (firm_id = public.my_firm_id() and exists (select 1 from public.events e where e.id = event_id));
drop policy if exists hearing_items_insert on public.hearing_items;
create policy hearing_items_insert on public.hearing_items for insert to authenticated
  with check (firm_id = public.my_firm_id() and exists (select 1 from public.events e where e.id = event_id and e.firm_id = public.my_firm_id()));
drop policy if exists hearing_items_update on public.hearing_items;
create policy hearing_items_update on public.hearing_items for update to authenticated
  using (firm_id = public.my_firm_id() and exists (select 1 from public.events e where e.id = event_id))
  with check (firm_id = public.my_firm_id());
drop policy if exists hearing_items_delete on public.hearing_items;
create policy hearing_items_delete on public.hearing_items for delete to authenticated
  using (firm_id = public.my_firm_id() and exists (select 1 from public.events e where e.id = event_id));

-- ---------- Morning cause list ----------
-- Each person can turn the 7am message off on My account.
alter table public.profiles add column if not exists morning_list boolean not null default true;

-- One morning list per person per day per channel, so nothing is sent twice.
create table if not exists public.morning_list_log (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  firm_id uuid references public.firms (id) on delete cascade,
  day date not null,
  channel text not null,
  status text not null default 'pending',
  detail text,
  created_at timestamptz not null default now(),
  unique (user_id, day, channel)
);
alter table public.morning_list_log enable row level security;
drop policy if exists morning_list_log_read on public.morning_list_log;
create policy morning_list_log_read on public.morning_list_log for select to authenticated
  using (user_id = auth.uid());
