-- C-Diary update 002: staff messaging and "remind client now".
-- Run once in Supabase: SQL Editor > New query > paste everything > Run.
-- Safe to run after schema.sql. Running it twice does no harm.

-- ---------- Messages between counsel and staff ----------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  matter_id uuid references public.matters (id) on delete cascade,     -- set: a matter's discussion
  recipient_id uuid references public.profiles (id) on delete cascade, -- set: a direct message
  body text not null check (char_length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  constraint messages_one_target check (matter_id is null or recipient_id is null)
);
create index if not exists messages_firm_time_idx on public.messages (firm_id, created_at desc);
create index if not exists messages_matter_idx on public.messages (matter_id, created_at);
create index if not exists messages_dm_idx on public.messages (recipient_id, sender_id, created_at);

alter table public.profiles add column if not exists messages_seen_at timestamptz not null default now();

create or replace function public.stamp_message() returns trigger
language plpgsql set search_path = public as $$
begin
  new.firm_id := public.my_firm_id();
  new.sender_id := auth.uid();
  new.created_at := now();
  return new;
end $$;

drop trigger if exists messages_stamp on public.messages;
create trigger messages_stamp before insert on public.messages
for each row execute function public.stamp_message();

alter table public.messages enable row level security;

-- Firm-wide and matter messages: everyone in the firm. Direct messages: only the two people.
drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select to authenticated
  using (
    firm_id = public.my_firm_id()
    and (recipient_id is null or recipient_id = auth.uid() or sender_id = auth.uid())
  );

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
  with check (
    firm_id = public.my_firm_id()
    and sender_id = auth.uid()
    and (recipient_id is null or exists (select 1 from public.profiles p where p.id = recipient_id and p.firm_id = public.my_firm_id()))
    and (matter_id is null or exists (select 1 from public.matters m where m.id = matter_id and m.firm_id = public.my_firm_id()))
  );

drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages for delete to authenticated
  using (sender_id = auth.uid());

-- Live updates: new messages appear without refreshing.
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- ---------- "Remind client now" ----------
-- Allow manual client reminders, and allow more than one per hearing.
alter table public.reminder_log drop constraint if exists reminder_log_kind_check;
alter table public.reminder_log add constraint reminder_log_kind_check
  check (kind in ('day', 'hour', 'client_day', 'client_update', 'client_manual'));

alter table public.reminder_log drop constraint if exists reminder_log_event_id_kind_recipient_key;
create unique index if not exists reminder_log_once_idx
  on public.reminder_log (event_id, kind, recipient)
  where kind <> 'client_manual';
