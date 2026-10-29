-- C-Diary: database schema
-- Run this once in Supabase: SQL Editor > New query > paste everything > Run.

create extension if not exists pgcrypto;

-- ---------- Types ----------
do $$ begin
  create type public.staff_role as enum ('admin', 'partner', 'associate', 'clerk');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.event_type as enum ('hearing', 'filing', 'client', 'internal');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.event_outcome as enum ('adjourned', 'reserved', 'judgment', 'struck_out', 'settled', 'held', 'other');
exception when duplicate_object then null; end $$;

-- ---------- Tables ----------
create table if not exists public.firms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  join_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  firm_id uuid references public.firms (id) on delete set null,
  full_name text not null default '',
  phone text,
  role public.staff_role not null default 'associate',
  created_at timestamptz not null default now()
);

create table if not exists public.matters (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  suit_number text,
  court text,
  courtroom text,
  judge text,
  client_name text,
  client_phone text,
  opposing_counsel text,
  lead_lawyer_id uuid references public.profiles (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'closed')),
  description text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists matters_firm_idx on public.matters (firm_id, status);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  matter_id uuid references public.matters (id) on delete cascade,
  type public.event_type not null default 'hearing',
  title text not null check (char_length(trim(title)) > 0),
  starts_at timestamptz not null,
  purpose text,
  court text,
  courtroom text,
  lawyer_id uuid references public.profiles (id) on delete set null,
  notes text,
  remind_day boolean not null default true,
  remind_hour boolean not null default true,
  remind_client boolean not null default false,
  outcome public.event_outcome,
  outcome_note text,
  outcome_recorded_at timestamptz,
  outcome_recorded_by uuid references public.profiles (id) on delete set null,
  next_event_id uuid references public.events (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists events_firm_time_idx on public.events (firm_id, starts_at);
create index if not exists events_matter_idx on public.events (matter_id, starts_at);
create index if not exists events_lawyer_idx on public.events (lawyer_id, starts_at);

create table if not exists public.reminder_log (
  id bigserial primary key,
  firm_id uuid not null references public.firms (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  kind text not null check (kind in ('day', 'hour', 'client_day', 'client_update')),
  channel text not null,
  recipient text not null,
  status text not null default 'pending',
  detail text,
  created_at timestamptz not null default now(),
  unique (event_id, kind, recipient)
);
create index if not exists reminder_log_firm_idx on public.reminder_log (firm_id, created_at desc);

-- ---------- Helpers ----------
create or replace function public.my_firm_id() returns uuid
language sql stable security definer set search_path = public as $$
  select firm_id from public.profiles where id = auth.uid()
$$;

create or replace function public.my_role() returns public.staff_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

-- New sign-ups get a profile automatically.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'phone', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------- Guards ----------
-- Only admins change roles or remove people; nobody moves themselves between firms.
create or replace function public.guard_profile_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('app.bypass_guard', true), '') = 'on' then return new; end if;
  if new.role is distinct from old.role or new.firm_id is distinct from old.firm_id then
    if public.my_role() is distinct from 'admin' or old.firm_id is distinct from public.my_firm_id() then
      raise exception 'Only a firm admin can change roles or remove staff.';
    end if;
    if new.id = auth.uid() then
      raise exception 'You cannot change your own role or remove yourself.';
    end if;
    if new.firm_id is not null and new.firm_id is distinct from old.firm_id then
      raise exception 'Staff can only be removed, not moved to another firm.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
for each row execute function public.guard_profile_update();

-- Fill firm and author on insert.
create or replace function public.stamp_row() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.firm_id is null then new.firm_id := public.my_firm_id(); end if;
  if auth.uid() is not null then new.created_by := auth.uid(); end if;
  return new;
end $$;

drop trigger if exists matters_stamp on public.matters;
create trigger matters_stamp before insert on public.matters
for each row execute function public.stamp_row();

drop trigger if exists events_stamp on public.events;
create trigger events_stamp before insert on public.events
for each row execute function public.stamp_row();

-- New events must be in the future. Past events keep their details; only the outcome can be recorded.
create or replace function public.guard_event() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('app.bypass_guard', true), '') = 'on' then
    new.updated_at := now();
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.starts_at < now() then
      raise exception 'That date and time has already passed. Pick a time in the future.';
    end if;
    return new;
  end if;
  new.updated_at := now();
  new.firm_id := old.firm_id;
  if old.starts_at < now() then
    if (new.title, new.starts_at, new.type, new.matter_id, new.purpose, new.court, new.courtroom, new.lawyer_id, new.notes)
       is distinct from
       (old.title, old.starts_at, old.type, old.matter_id, old.purpose, old.court, old.courtroom, old.lawyer_id, old.notes) then
      raise exception 'This event has passed, so its details can no longer be edited. You can still record its outcome.';
    end if;
  elsif new.starts_at is distinct from old.starts_at and new.starts_at < now() then
    raise exception 'That date and time has already passed. Pick a time in the future.';
  end if;
  if (new.outcome, new.outcome_note, new.next_event_id) is distinct from (old.outcome, old.outcome_note, old.next_event_id) then
    raise exception 'Use Record outcome to record what happened in court.';
  end if;
  return new;
end $$;

drop trigger if exists events_guard on public.events;
create trigger events_guard before insert or update on public.events
for each row execute function public.guard_event();

-- ---------- Actions (called from the app) ----------
create or replace function public.create_firm(firm_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  insert into profiles (id) values (auth.uid()) on conflict (id) do nothing;
  if (select firm_id from profiles where id = auth.uid()) is not null then
    raise exception 'You already belong to a firm.';
  end if;
  insert into firms (name) values (trim(firm_name)) returning id into fid;
  perform set_config('app.bypass_guard', 'on', true);
  update profiles set firm_id = fid, role = 'admin' where id = auth.uid();
  perform set_config('app.bypass_guard', 'off', true);
  return fid;
end $$;

create or replace function public.join_firm(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  insert into profiles (id) values (auth.uid()) on conflict (id) do nothing;
  if (select firm_id from profiles where id = auth.uid()) is not null then
    raise exception 'You already belong to a firm.';
  end if;
  select id into fid from firms where join_code = upper(trim(code));
  if fid is null then raise exception 'That join code is not valid. Check it with your firm admin.'; end if;
  perform set_config('app.bypass_guard', 'on', true);
  update profiles set firm_id = fid, role = 'associate' where id = auth.uid();
  perform set_config('app.bypass_guard', 'off', true);
  return fid;
end $$;

create or replace function public.regenerate_join_code() returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if my_role() is distinct from 'admin' then raise exception 'Only a firm admin can change the join code.'; end if;
  c := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
  update firms set join_code = c where id = my_firm_id();
  return c;
end $$;

create or replace function public.record_outcome(
  p_event_id uuid,
  p_outcome public.event_outcome,
  p_note text,
  p_next_at timestamptz,
  p_next_purpose text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare ev events%rowtype; nid uuid;
begin
  select * into ev from events where id = p_event_id and firm_id = my_firm_id();
  if not found then raise exception 'Event not found.'; end if;
  if ev.outcome is not null then raise exception 'An outcome has already been recorded for this event.'; end if;
  if (ev.starts_at at time zone 'Africa/Lagos')::date > (now() at time zone 'Africa/Lagos')::date then
    raise exception 'You can record the outcome on or after the day of the hearing.';
  end if;
  if p_outcome in ('adjourned', 'reserved') then
    if p_next_at is null then raise exception 'Pick the next date.'; end if;
    if p_next_at <= now() then raise exception 'The next date must be in the future.'; end if;
  end if;

  perform set_config('app.bypass_guard', 'on', true);
  if p_outcome in ('adjourned', 'reserved') then
    insert into events (firm_id, matter_id, type, title, starts_at, purpose, court, courtroom, lawyer_id,
                        remind_day, remind_hour, remind_client, created_by)
    values (ev.firm_id, ev.matter_id, 'hearing', ev.title, p_next_at,
            coalesce(nullif(trim(p_next_purpose), ''), case when p_outcome = 'reserved' then 'Ruling' else ev.purpose end),
            ev.court, ev.courtroom, ev.lawyer_id, ev.remind_day, ev.remind_hour, ev.remind_client, auth.uid())
    returning id into nid;
  end if;
  update events
     set outcome = p_outcome,
         outcome_note = nullif(trim(p_note), ''),
         outcome_recorded_at = now(),
         outcome_recorded_by = auth.uid(),
         next_event_id = nid
   where id = ev.id;
  if p_outcome = 'settled' and ev.matter_id is not null then
    update matters set status = 'closed' where id = ev.matter_id;
  end if;
  perform set_config('app.bypass_guard', 'off', true);
  return nid;
end $$;

revoke execute on function public.create_firm(text) from anon;
revoke execute on function public.join_firm(text) from anon;
revoke execute on function public.regenerate_join_code() from anon;
revoke execute on function public.record_outcome(uuid, public.event_outcome, text, timestamptz, text) from anon;

-- ---------- Row-level security: each firm sees only its own data ----------
alter table public.firms enable row level security;
alter table public.profiles enable row level security;
alter table public.matters enable row level security;
alter table public.events enable row level security;
alter table public.reminder_log enable row level security;

drop policy if exists firms_read on public.firms;
create policy firms_read on public.firms for select to authenticated using (id = public.my_firm_id());
drop policy if exists firms_update on public.firms;
create policy firms_update on public.firms for update to authenticated
  using (id = public.my_firm_id() and public.my_role() = 'admin');

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or firm_id = public.my_firm_id());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or (firm_id = public.my_firm_id() and public.my_role() = 'admin'))
  with check (id = auth.uid() or public.my_role() = 'admin');

drop policy if exists matters_read on public.matters;
create policy matters_read on public.matters for select to authenticated using (firm_id = public.my_firm_id());
drop policy if exists matters_insert on public.matters;
create policy matters_insert on public.matters for insert to authenticated with check (firm_id = public.my_firm_id());
drop policy if exists matters_update on public.matters;
create policy matters_update on public.matters for update to authenticated
  using (firm_id = public.my_firm_id()) with check (firm_id = public.my_firm_id());
drop policy if exists matters_delete on public.matters;
create policy matters_delete on public.matters for delete to authenticated
  using (firm_id = public.my_firm_id() and public.my_role() in ('admin', 'partner'));

drop policy if exists events_read on public.events;
create policy events_read on public.events for select to authenticated using (firm_id = public.my_firm_id());
drop policy if exists events_insert on public.events;
create policy events_insert on public.events for insert to authenticated with check (firm_id = public.my_firm_id());
drop policy if exists events_update on public.events;
create policy events_update on public.events for update to authenticated
  using (firm_id = public.my_firm_id()) with check (firm_id = public.my_firm_id());
drop policy if exists events_delete on public.events;
create policy events_delete on public.events for delete to authenticated
  using (firm_id = public.my_firm_id() and public.my_role() in ('admin', 'partner'));

drop policy if exists reminder_log_read on public.reminder_log;
create policy reminder_log_read on public.reminder_log for select to authenticated using (firm_id = public.my_firm_id());
