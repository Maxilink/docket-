-- C-Diary update 006: email reminders (sent through Brevo), and the "Other" event type.
-- Run it in Supabase > SQL Editor after 005. Running it twice does no harm.

-- 1. A client email address on each matter.
alter table public.matters add column if not exists client_email text;
alter table public.matters drop constraint if exists matters_client_email_check;
alter table public.matters add constraint matters_client_email_check
  check (client_email is null or client_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- 2. New kinds of reminder in the log: counsel's emails (day before, within the hour) and the client's email.
alter table public.reminder_log drop constraint if exists reminder_log_kind_check;
alter table public.reminder_log add constraint reminder_log_kind_check
  check (kind in ('day', 'hour', 'client_day', 'client_update', 'client_manual', 'push_day', 'push_hour',
                  'email_day', 'email_hour', 'client_email_day'));

-- 3. The reminder schedule needs each lawyer's sign-in email. Only the server (service role) can call this.
create or replace function public.member_emails(p_ids uuid[])
returns table (id uuid, email text)
language sql stable security definer set search_path = public, auth
as $$
  select u.id, u.email::text from auth.users u
  where u.id = any (p_ids) and u.email is not null and u.email_confirmed_at is not null;
$$;
revoke execute on function public.member_emails(uuid[]) from public, anon, authenticated;
grant execute on function public.member_emails(uuid[]) to service_role;

-- 4. A fifth event type, "Other", with a short name the user types in (e.g. "Arbitration", "Site visit").
alter type public.event_type add value if not exists 'other';
alter table public.events add column if not exists type_label text;
alter table public.events drop constraint if exists events_type_label_check;
alter table public.events add constraint events_type_label_check
  check (type_label is null or char_length(type_label) <= 60);
