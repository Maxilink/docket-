-- C-Diary update 007: court closure days for the deadline calculator.
-- Two kinds:
--   closed:   the registry is shut (Sallah, Maulud, other holidays the Federal Government announces, strikes).
--             A deadline that lands on one of these days is flagged and an open day is offered instead.
--   vacation: court vacation. The registry usually stays open, so dates are not moved; deadlines that
--             run through a vacation are flagged so counsel can check whether time runs.
-- Run it in Supabase > SQL Editor after 006. Running it twice does no harm.

create table if not exists public.court_closures (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  label text not null check (char_length(label) between 1 and 80),
  kind text not null default 'closed' check (kind in ('closed', 'vacation')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on <= 120)
);
alter table public.court_closures add column if not exists kind text not null default 'closed';
create index if not exists court_closures_firm_idx on public.court_closures (firm_id, starts_on);

create or replace function public.stamp_court_closure() returns trigger
language plpgsql set search_path = public as $$
begin
  new.firm_id := public.my_firm_id();
  new.created_by := auth.uid();
  new.created_at := now();
  return new;
end $$;
drop trigger if exists stamp_court_closure on public.court_closures;
create trigger stamp_court_closure before insert on public.court_closures
for each row execute function public.stamp_court_closure();

alter table public.court_closures enable row level security;

-- Everyone in the firm sees the closures and can add one; the person who added it, or an admin or partner, can remove it.
drop policy if exists court_closures_read on public.court_closures;
create policy court_closures_read on public.court_closures for select to authenticated
  using (firm_id = public.my_firm_id());
drop policy if exists court_closures_insert on public.court_closures;
create policy court_closures_insert on public.court_closures for insert to authenticated
  with check (public.my_firm_id() is not null);
drop policy if exists court_closures_delete on public.court_closures;
create policy court_closures_delete on public.court_closures for delete to authenticated
  using (firm_id = public.my_firm_id() and (created_by = auth.uid() or public.my_role() in ('admin', 'partner')));
