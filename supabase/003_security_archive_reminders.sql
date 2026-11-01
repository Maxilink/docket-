-- C-Diary update 003
--   * New staff wait for an Admin to approve them; the join code changes when someone is removed
--   * Too many wrong join codes are blocked for an hour
--   * Events and matters can only point to people and matters in the same firm
--   * Archive instead of delete (Admins and Partners); only Admins can delete for good, and only from the archive
--   * Activity log of who changed what
--   * Reminders survive reschedules, failed sends are retried, and each client text records who sent it
--   * Push notifications on phones and computers
--
-- Run once in Supabase: SQL Editor > New query > paste everything > Run.
-- Run it after schema.sql and 002_messages_and_reminders.sql. Running it twice does no harm.

-- =====================================================================
-- 1. Joining a firm: approval by an Admin
-- =====================================================================
alter table public.profiles add column if not exists status text not null default 'active';
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check check (status in ('active', 'pending'));
alter table public.profiles add column if not exists requested_at timestamptz;

-- Only approved members count as members. Pending people can see their own profile and nothing else.
create or replace function public.my_firm_id() returns uuid
language sql stable security definer set search_path = public as $$
  select firm_id from public.profiles where id = auth.uid() and status = 'active'
$$;

create or replace function public.my_role() returns public.staff_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and status = 'active'
$$;

-- Admins also see people waiting to join. Everyone else sees approved colleagues only.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or (firm_id = public.my_firm_id() and (status = 'active' or public.my_role() = 'admin'))
  );

-- Role, firm and approval can only be changed by the firm's Admin (or by the app's own functions).
create or replace function public.guard_profile_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('app.bypass_guard', true), '') = 'on' then return new; end if;
  -- Changes made in the Supabase dashboard or by a cascade have no signed-in user.
  if auth.uid() is null then return new; end if;
  if new.role is distinct from old.role
     or new.firm_id is distinct from old.firm_id
     or new.status is distinct from old.status then
    if public.my_role() is distinct from 'admin' or old.firm_id is distinct from public.my_firm_id() then
      raise exception 'Only a firm admin can approve, change roles or remove staff.';
    end if;
    if new.id = auth.uid() then
      raise exception 'You cannot change your own role or remove yourself.';
    end if;
    if new.firm_id is not null and new.firm_id is distinct from old.firm_id then
      raise exception 'Staff can only be removed, not moved to another firm.';
    end if;
    if new.firm_id is null then
      new.status := 'active';
    end if;
  end if;
  return new;
end $$;

create or replace function public.create_firm(firm_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  insert into profiles (id) values (auth.uid()) on conflict (id) do nothing;
  if (select firm_id from profiles where id = auth.uid()) is not null then
    raise exception 'You already belong to a firm, or are waiting to join one.';
  end if;
  insert into firms (name) values (trim(firm_name)) returning id into fid;
  perform set_config('app.bypass_guard', 'on', true);
  update profiles set firm_id = fid, role = 'admin', status = 'active', requested_at = null where id = auth.uid();
  perform set_config('app.bypass_guard', 'off', true);
  return fid;
end $$;

create table if not exists public.join_attempts (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists join_attempts_user_idx on public.join_attempts (user_id, created_at desc);
alter table public.join_attempts enable row level security;

-- Returns the firm id when the request is made, or null when the code is wrong.
-- (It does not raise an error for a wrong code, so the attempt is still counted.)
create or replace function public.join_firm(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  insert into profiles (id) values (auth.uid()) on conflict (id) do nothing;
  if (select firm_id from profiles where id = auth.uid()) is not null then
    raise exception 'You already belong to a firm, or are waiting to join one.';
  end if;
  if (select count(*) from join_attempts where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many tries. Wait an hour, or check the code with your firm admin.';
  end if;
  insert into join_attempts (user_id) values (auth.uid());
  select id into fid from firms where join_code = upper(trim(code));
  if fid is null then return null; end if;
  perform set_config('app.bypass_guard', 'on', true);
  update profiles set firm_id = fid, role = 'associate', status = 'pending', requested_at = now() where id = auth.uid();
  perform set_config('app.bypass_guard', 'off', true);
  return fid;
end $$;

-- The person waiting can withdraw their request.
create or replace function public.cancel_join_request() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.bypass_guard', 'on', true);
  update profiles set firm_id = null, status = 'active', requested_at = null where id = auth.uid() and status = 'pending';
  perform set_config('app.bypass_guard', 'off', true);
end $$;

-- Admin actions on staff. (Removing someone through a plain update is blocked by the row rules,
-- because the removed person's row would no longer belong to the firm.)
create or replace function public.approve_member(p_user uuid, p_role public.staff_role) returns void
language plpgsql security definer set search_path = public as $$
begin
  if my_role() is distinct from 'admin' then raise exception 'Only a firm admin can approve new staff.'; end if;
  update profiles set status = 'active', role = coalesce(p_role, 'associate'), requested_at = null
   where id = p_user and firm_id = my_firm_id() and status = 'pending';
  if not found then raise exception 'That request is no longer waiting.'; end if;
end $$;

create or replace function public.remove_member(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if my_role() is distinct from 'admin' then raise exception 'Only a firm admin can remove staff.'; end if;
  if p_user = auth.uid() then raise exception 'You cannot remove yourself.'; end if;
  perform set_config('app.bypass_guard', 'on', true);
  update profiles set firm_id = null, status = 'active', requested_at = null
   where id = p_user and firm_id = my_firm_id();
  if not found then raise exception 'That person is not in your firm.'; end if;
  perform set_config('app.bypass_guard', 'off', true);
end $$;

-- Lets a signed-in person see which firm they belong to or are waiting for.
create or replace function public.my_membership() returns table (firm_name text, status text)
language sql stable security definer set search_path = public as $$
  select f.name, p.status from profiles p join firms f on f.id = p.firm_id where p.id = auth.uid()
$$;

-- Direct messages can only go to approved colleagues.
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
  with check (
    firm_id = public.my_firm_id()
    and sender_id = auth.uid()
    and (recipient_id is null or exists (select 1 from public.profiles p where p.id = recipient_id and p.firm_id = public.my_firm_id() and p.status = 'active'))
    and (matter_id is null or exists (select 1 from public.matters m where m.id = matter_id and m.firm_id = public.my_firm_id()))
  );

-- =====================================================================
-- 2. Activity log
-- =====================================================================
create table if not exists public.activity_log (
  id bigserial primary key,
  firm_id uuid not null references public.firms (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  summary text not null,
  created_at timestamptz not null default now()
);
create index if not exists activity_log_firm_idx on public.activity_log (firm_id, created_at desc);
create index if not exists activity_log_entity_idx on public.activity_log (entity_id, created_at desc);
alter table public.activity_log enable row level security;

drop policy if exists activity_read on public.activity_log;
create policy activity_read on public.activity_log for select to authenticated
  using (firm_id = public.my_firm_id() and public.my_role() in ('admin', 'partner'));

create or replace function public.log_activity(p_firm uuid, p_action text, p_entity text, p_entity_id uuid, p_summary text) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Skip while a whole firm is being deleted.
  if p_firm is null or not exists (select 1 from firms where id = p_firm) then return; end if;
  insert into activity_log (firm_id, actor_id, action, entity, entity_id, summary)
  values (p_firm, auth.uid(), p_action, p_entity, p_entity_id, p_summary);
end $$;

create or replace function public.fmt_when(t timestamptz) returns text
language sql immutable set search_path = public as $$
  select to_char(t at time zone 'Africa/Lagos', 'FMDD Mon YYYY, FMHH12:MI am')
$$;

create or replace function public.person_name(p uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(trim(full_name), ''), 'a colleague') from profiles where id = p
$$;

create or replace function public.audit_matter() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform log_activity(new.firm_id, 'matter.created', 'matter', new.id, 'Opened matter ' || new.title);
  elsif tg_op = 'DELETE' then
    perform log_activity(old.firm_id, 'matter.deleted', 'matter', old.id, 'Permanently deleted matter ' || old.title);
  else
    if to_jsonb(new) = to_jsonb(old) then return new; end if;
    if new.archived_at is distinct from old.archived_at then
      perform log_activity(new.firm_id, case when new.archived_at is null then 'matter.restored' else 'matter.archived' end, 'matter', new.id,
        case when new.archived_at is null then 'Restored matter ' else 'Archived matter ' end || new.title);
    elsif new.status is distinct from old.status then
      perform log_activity(new.firm_id, 'matter.' || new.status, 'matter', new.id,
        case when new.status = 'closed' then 'Closed matter ' else 'Reopened matter ' end || new.title);
    else
      perform log_activity(new.firm_id, 'matter.edited', 'matter', new.id, 'Edited matter ' || new.title);
    end if;
  end if;
  return coalesce(new, old);
end $$;

create or replace function public.audit_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare what text;
begin
  if tg_op = 'INSERT' then
    perform log_activity(new.firm_id, 'event.created', 'event', new.id, 'Added ' || new.title || ' for ' || fmt_when(new.starts_at));
  elsif tg_op = 'DELETE' then
    -- Events removed along with their matter are covered by the matter's entry.
    if old.matter_id is not null and not exists (select 1 from matters where id = old.matter_id) then return old; end if;
    perform log_activity(old.firm_id, 'event.deleted', 'event', old.id, 'Permanently deleted ' || old.title || ' (' || fmt_when(old.starts_at) || ')');
  else
    if (to_jsonb(new) - 'updated_at') = (to_jsonb(old) - 'updated_at') then return new; end if;
    what := new.title || ' (' || fmt_when(old.starts_at) || ')';
    if new.archived_at is distinct from old.archived_at then
      -- Events archived or restored together with their matter are covered by the matter's entry.
      if coalesce(current_setting('app.with_matter', true), '') = 'on' then return new; end if;
      perform log_activity(new.firm_id, case when new.archived_at is null then 'event.restored' else 'event.archived' end, 'event', new.id,
        case when new.archived_at is null then 'Restored ' else 'Archived ' end || what);
    elsif new.outcome is distinct from old.outcome then
      perform log_activity(new.firm_id, 'event.outcome', 'event', new.id,
        'Recorded outcome for ' || what || ': ' || replace(new.outcome::text, '_', ' '));
    elsif new.starts_at is distinct from old.starts_at then
      perform log_activity(new.firm_id, 'event.rescheduled', 'event', new.id,
        'Moved ' || new.title || ' from ' || fmt_when(old.starts_at) || ' to ' || fmt_when(new.starts_at));
    elsif new.lawyer_id is distinct from old.lawyer_id then
      perform log_activity(new.firm_id, 'event.reassigned', 'event', new.id,
        'Reassigned ' || what || ' to ' || coalesce(person_name(new.lawyer_id), 'nobody'));
    else
      perform log_activity(new.firm_id, 'event.edited', 'event', new.id, 'Edited ' || what);
    end if;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists matters_audit on public.matters;
create trigger matters_audit after insert or update or delete on public.matters
for each row execute function public.audit_matter();

drop trigger if exists events_audit on public.events;
create trigger events_audit after insert or update or delete on public.events
for each row execute function public.audit_event();

-- People: join requests, approvals, role changes, removals. Also rotates the join code after a removal.
create or replace function public.after_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text := coalesce(nullif(trim(new.full_name), ''), 'Someone');
begin
  if old.firm_id is null and new.firm_id is not null then
    if new.status = 'pending' then
      perform log_activity(new.firm_id, 'staff.requested', 'profile', new.id, who || ' asked to join the firm');
    else
      perform log_activity(new.firm_id, 'firm.created', 'profile', new.id, who || ' set up the firm');
    end if;
  elsif old.firm_id is not null and new.firm_id is null then
    if old.status = 'pending' then
      if new.id = auth.uid() then
        perform log_activity(old.firm_id, 'staff.withdrew', 'profile', new.id, who || ' withdrew their request to join');
      else
        perform log_activity(old.firm_id, 'staff.declined', 'profile', new.id, 'Declined ' || who || '''s request to join');
      end if;
    else
      perform log_activity(old.firm_id, 'staff.removed', 'profile', new.id, 'Removed ' || who || ' from the firm. The join code was changed.');
      -- A removed person can't come back with the old code.
      update firms set join_code = upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)) where id = old.firm_id;
      -- Stop sending them reminders for the firm's upcoming hearings.
      perform set_config('app.bypass_guard', 'on', true);
      update events set lawyer_id = null where firm_id = old.firm_id and lawyer_id = old.id and starts_at > now() and outcome is null;
      perform set_config('app.bypass_guard', 'off', true);
      delete from push_subscriptions where user_id = old.id;
    end if;
  elsif new.firm_id is not null then
    if old.status = 'pending' and new.status = 'active' then
      perform log_activity(new.firm_id, 'staff.approved', 'profile', new.id, 'Approved ' || who || ' to join as ' || initcap(new.role::text));
    elsif new.role is distinct from old.role then
      perform log_activity(new.firm_id, 'staff.role', 'profile', new.id, 'Changed ' || who || '''s role to ' || initcap(new.role::text));
    end if;
  end if;
  return new;
end $$;

create or replace function public.regenerate_join_code() returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if my_role() is distinct from 'admin' then raise exception 'Only a firm admin can change the join code.'; end if;
  c := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
  update firms set join_code = c where id = my_firm_id();
  perform log_activity(my_firm_id(), 'firm.code', 'firm', my_firm_id(), 'Made a new join code');
  return c;
end $$;

-- =====================================================================
-- 3. Records can only point inside the same firm
-- =====================================================================
create or replace function public.check_refs() returns trigger
language plpgsql security definer set search_path = public as $$
declare f uuid := coalesce(new.firm_id, public.my_firm_id());
begin
  if tg_table_name = 'events' then
    if new.matter_id is not null and (tg_op = 'INSERT' or new.matter_id is distinct from old.matter_id)
       and not exists (select 1 from matters where id = new.matter_id and firm_id = f) then
      raise exception 'Pick a matter from your firm''s files.';
    end if;
    if new.lawyer_id is not null and (tg_op = 'INSERT' or new.lawyer_id is distinct from old.lawyer_id)
       and not exists (select 1 from profiles where id = new.lawyer_id and firm_id = f and status = 'active') then
      if coalesce(current_setting('app.bypass_guard', true), '') = 'on' then
        new.lawyer_id := null; -- e.g. the next hearing of a lawyer who has since left
      else
        raise exception 'Pick counsel from your firm''s staff.';
      end if;
    end if;
  elsif tg_table_name = 'matters' then
    if new.lead_lawyer_id is not null and (tg_op = 'INSERT' or new.lead_lawyer_id is distinct from old.lead_lawyer_id)
       and not exists (select 1 from profiles where id = new.lead_lawyer_id and firm_id = f and status = 'active') then
      raise exception 'Pick a lead lawyer from your firm''s staff.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists events_check_refs on public.events;
create trigger events_check_refs before insert or update on public.events
for each row execute function public.check_refs();

drop trigger if exists matters_check_refs on public.matters;
create trigger matters_check_refs before insert or update on public.matters
for each row execute function public.check_refs();

-- =====================================================================
-- 4. Archive instead of delete
-- =====================================================================
alter table public.matters add column if not exists archived_at timestamptz;
alter table public.matters add column if not exists archived_by uuid references public.profiles (id) on delete set null;
alter table public.events add column if not exists archived_at timestamptz;
alter table public.events add column if not exists archived_by uuid references public.profiles (id) on delete set null;
create index if not exists events_archived_idx on public.events (firm_id, archived_at) where archived_at is not null;
create index if not exists matters_archived_idx on public.matters (firm_id, archived_at) where archived_at is not null;

-- Archived records disappear from every screen and from reminders. Nobody can delete through the normal app;
-- Admins delete for good from the archive.
drop policy if exists matters_read on public.matters;
create policy matters_read on public.matters for select to authenticated
  using (firm_id = public.my_firm_id() and archived_at is null);
drop policy if exists matters_update on public.matters;
create policy matters_update on public.matters for update to authenticated
  using (firm_id = public.my_firm_id() and archived_at is null)
  with check (firm_id = public.my_firm_id() and archived_at is null);
drop policy if exists matters_delete on public.matters;

drop policy if exists events_read on public.events;
create policy events_read on public.events for select to authenticated
  using (firm_id = public.my_firm_id() and archived_at is null);
drop policy if exists events_update on public.events;
create policy events_update on public.events for update to authenticated
  using (firm_id = public.my_firm_id() and archived_at is null)
  with check (firm_id = public.my_firm_id() and archived_at is null);
drop policy if exists events_delete on public.events;

-- A matter's discussion is hidden while the matter is archived.
drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select to authenticated
  using (
    firm_id = public.my_firm_id()
    and (recipient_id is null or recipient_id = auth.uid() or sender_id = auth.uid())
    and (matter_id is null or exists (select 1 from public.matters m where m.id = matter_id))
  );

create or replace function public.require_archiver() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if my_role() is null or my_role() not in ('admin', 'partner') then
    raise exception 'Only partners and admins can archive or restore.';
  end if;
end $$;

create or replace function public.archive_matter(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare stamp timestamptz := now();
begin
  perform require_archiver();
  update matters set archived_at = stamp, archived_by = auth.uid()
   where id = p_id and firm_id = my_firm_id() and archived_at is null;
  if not found then raise exception 'Matter not found.'; end if;
  perform set_config('app.bypass_guard', 'on', true);
  perform set_config('app.with_matter', 'on', true);
  update events set archived_at = stamp, archived_by = auth.uid() where matter_id = p_id and archived_at is null;
  perform set_config('app.with_matter', 'off', true);
  perform set_config('app.bypass_guard', 'off', true);
end $$;

create or replace function public.archive_event(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform require_archiver();
  perform set_config('app.bypass_guard', 'on', true);
  update events set archived_at = now(), archived_by = auth.uid()
   where id = p_id and firm_id = my_firm_id() and archived_at is null;
  if not found then raise exception 'Event not found.'; end if;
  perform set_config('app.bypass_guard', 'off', true);
end $$;

create or replace function public.restore_matter(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare stamp timestamptz;
begin
  perform require_archiver();
  select archived_at into stamp from matters where id = p_id and firm_id = my_firm_id() and archived_at is not null;
  if stamp is null then raise exception 'That matter is not in the archive.'; end if;
  update matters set archived_at = null, archived_by = null where id = p_id;
  perform set_config('app.bypass_guard', 'on', true);
  perform set_config('app.with_matter', 'on', true);
  update events set archived_at = null, archived_by = null where matter_id = p_id and archived_at = stamp;
  perform set_config('app.with_matter', 'off', true);
  perform set_config('app.bypass_guard', 'off', true);
end $$;

create or replace function public.restore_event(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare ev events%rowtype;
begin
  perform require_archiver();
  select * into ev from events where id = p_id and firm_id = my_firm_id() and archived_at is not null;
  if not found then raise exception 'That event is not in the archive.'; end if;
  if ev.matter_id is not null and exists (select 1 from matters where id = ev.matter_id and archived_at is not null) then
    raise exception 'Its matter is archived. Restore the matter first.';
  end if;
  perform set_config('app.bypass_guard', 'on', true);
  update events set archived_at = null, archived_by = null where id = p_id;
  perform set_config('app.bypass_guard', 'off', true);
end $$;

create or replace function public.delete_forever(p_kind text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if my_role() is distinct from 'admin' then raise exception 'Only an admin can delete permanently.'; end if;
  if p_kind = 'matter' then
    delete from matters where id = p_id and firm_id = my_firm_id() and archived_at is not null;
  elsif p_kind = 'event' then
    delete from events where id = p_id and firm_id = my_firm_id() and archived_at is not null;
  else
    raise exception 'Unknown item.';
  end if;
  if not found then raise exception 'Only archived items can be deleted permanently.'; end if;
end $$;

-- What the Archive page lists. Events archived along with their matter are listed under the matter.
create or replace function public.archived_items()
returns table (kind text, id uuid, title text, detail text, starts_at timestamptz, archived_at timestamptz, archived_by_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_archiver();
  return query
    select 'matter'::text, m.id, m.title,
           concat_ws(' · ', m.suit_number, m.client_name,
                     (select count(*)::text || ' dates' from events e where e.matter_id = m.id and e.archived_at = m.archived_at)),
           null::timestamptz, m.archived_at, person_name(m.archived_by)
      from matters m
     where m.firm_id = my_firm_id() and m.archived_at is not null
    union all
    select 'event'::text, e.id, e.title, concat_ws(' · ', m.title, m.suit_number), e.starts_at, e.archived_at, person_name(e.archived_by)
      from events e left join matters m on m.id = e.matter_id
     where e.firm_id = my_firm_id() and e.archived_at is not null
       and (m.id is null or m.archived_at is distinct from e.archived_at)
    order by 6 desc;
end $$;

-- record_outcome: refuses archived events, and only ever closes a matter in the same firm.
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
  select * into ev from events where id = p_event_id and firm_id = my_firm_id() and archived_at is null;
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
    update matters set status = 'closed' where id = ev.matter_id and firm_id = ev.firm_id;
  end if;
  perform set_config('app.bypass_guard', 'off', true);
  return nid;
end $$;

-- =====================================================================
-- 5. Reminders: per date (so reschedules get fresh reminders), retries, who sent client texts, push
-- =====================================================================
alter table public.reminder_log add column if not exists event_starts_at timestamptz;
alter table public.reminder_log add column if not exists attempts int not null default 1;
alter table public.reminder_log add column if not exists updated_at timestamptz not null default now();
alter table public.reminder_log add column if not exists sent_by uuid references public.profiles (id) on delete set null;

-- Existing reminders belong to each event's current date, so nothing is sent twice after this update.
update public.reminder_log r set event_starts_at = e.starts_at
  from public.events e where e.id = r.event_id and r.event_starts_at is null;

alter table public.reminder_log drop constraint if exists reminder_log_kind_check;
alter table public.reminder_log add constraint reminder_log_kind_check
  check (kind in ('day', 'hour', 'client_day', 'client_update', 'client_manual', 'push_day', 'push_hour'));

-- Any message logged without a date gets the hearing's current date. This keeps the old version of the app
-- (still live while you deploy) from sending the same reminder twice.
create or replace function public.stamp_reminder() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.event_starts_at is null then
    select starts_at into new.event_starts_at from events where id = new.event_id;
  end if;
  return new;
end $$;
drop trigger if exists reminder_log_stamp on public.reminder_log;
create trigger reminder_log_stamp before insert on public.reminder_log
for each row execute function public.stamp_reminder();

drop index if exists public.reminder_log_once_idx;
create unique index if not exists reminder_log_once_v2
  on public.reminder_log (event_id, kind, recipient, event_starts_at)
  where kind <> 'client_manual';

-- The reminder schedule calls this before sending. It returns an id when this message should be sent now,
-- or null when it was already sent, is being sent, or has failed three times.
-- A failed message is retried after 10 minutes; one stuck "sending" for 15 minutes is retried too.
create or replace function public.claim_reminder(
  p_firm uuid, p_event uuid, p_kind text, p_recipient text, p_starts timestamptz, p_channel text
) returns bigint
language plpgsql security definer set search_path = public as $$
declare rid bigint;
begin
  insert into reminder_log (firm_id, event_id, kind, channel, recipient, status, event_starts_at)
  values (p_firm, p_event, p_kind, p_channel, p_recipient, 'pending', p_starts)
  on conflict (event_id, kind, recipient, event_starts_at) where kind <> 'client_manual'
  do update set status = 'pending', attempts = reminder_log.attempts + 1, updated_at = now(), channel = excluded.channel
   where reminder_log.attempts < 3
     and ((reminder_log.status = 'failed' and reminder_log.updated_at < now() - interval '10 minutes')
       or (reminder_log.status = 'pending' and reminder_log.updated_at < now() - interval '15 minutes'))
  returning id into rid;
  return rid;
end $$;

-- Client texts sent from the app: show who sent them in the activity log.
create or replace function public.audit_client_text() returns trigger
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if new.kind in ('client_manual', 'client_update') then
    select title into t from events where id = new.event_id;
    insert into activity_log (firm_id, actor_id, action, entity, entity_id, summary)
    select new.firm_id, new.sent_by, 'client.text', 'event', new.event_id,
           case when new.status = 'failed' then 'Tried to text the client about ' else 'Texted the client about ' end || coalesce(t, 'a hearing')
     where exists (select 1 from firms where id = new.firm_id);
  end if;
  return new;
end $$;

drop trigger if exists reminder_log_audit on public.reminder_log;
create trigger reminder_log_audit after insert on public.reminder_log
for each row execute function public.audit_client_text();

-- Push notification subscriptions: one row per phone or browser.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_read on public.push_subscriptions;
create policy push_read on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
drop policy if exists push_delete on public.push_subscriptions;
create policy push_delete on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

-- Now that push_subscriptions exists, attach the people trigger.
drop trigger if exists profiles_after_update on public.profiles;
create trigger profiles_after_update after update on public.profiles
for each row execute function public.after_profile_update();

-- =====================================================================
-- 6. Who may call what
-- =====================================================================
revoke execute on function public.log_activity(uuid, text, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.claim_reminder(uuid, uuid, text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.claim_reminder(uuid, uuid, text, text, timestamptz, text) to service_role;
revoke execute on function public.person_name(uuid) from public, anon, authenticated;
revoke execute on function public.require_archiver() from public, anon;

revoke execute on function public.join_firm(text) from public, anon;
revoke execute on function public.create_firm(text) from public, anon;
revoke execute on function public.cancel_join_request() from public, anon;
revoke execute on function public.approve_member(uuid, public.staff_role) from public, anon;
revoke execute on function public.remove_member(uuid) from public, anon;
revoke execute on function public.my_membership() from public, anon;
revoke execute on function public.archive_matter(uuid) from public, anon;
revoke execute on function public.archive_event(uuid) from public, anon;
revoke execute on function public.restore_matter(uuid) from public, anon;
revoke execute on function public.restore_event(uuid) from public, anon;
revoke execute on function public.delete_forever(text, uuid) from public, anon;
revoke execute on function public.archived_items() from public, anon;
revoke execute on function public.regenerate_join_code() from public, anon;
revoke execute on function public.record_outcome(uuid, public.event_outcome, text, timestamptz, text) from public, anon;
grant execute on function public.join_firm(text), public.create_firm(text), public.cancel_join_request(), public.my_membership(),
  public.approve_member(uuid, public.staff_role), public.remove_member(uuid),
  public.archive_matter(uuid), public.archive_event(uuid), public.restore_matter(uuid), public.restore_event(uuid),
  public.delete_forever(text, uuid), public.archived_items(), public.regenerate_join_code(), public.require_archiver(),
  public.record_outcome(uuid, public.event_outcome, text, timestamptz, text)
  to authenticated;
