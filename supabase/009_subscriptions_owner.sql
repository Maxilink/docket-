-- C-Diary update 009: plans, subscriptions and payments (Paystack), and the owner dashboard.
-- Run it in Supabase > SQL Editor after 008. Running it twice does no harm.
--
-- Only the server (service role) writes these tables. Firms can read their own subscription and payments,
-- but nobody can change them from the browser, so a firm cannot mark itself as paid.

-- 1. Plans the owner offers. Prices are in kobo (₦1 = 100 kobo).
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  description text check (description is null or char_length(description) <= 300),
  price_kobo bigint not null check (price_kobo >= 10000),
  interval_months int not null default 1 check (interval_months in (1, 3, 6, 12)),
  max_users int check (max_users is null or max_users > 0),
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- 2. Each firm's subscription. A firm with no row is on its free trial, counted from when the firm was created.
create table if not exists public.firm_subscriptions (
  firm_id uuid primary key references public.firms(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete set null,
  status text not null default 'trial' check (status in ('trial', 'active', 'suspended', 'cancelled')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  suspended_reason text check (suspended_reason is null or char_length(suspended_reason) <= 300),
  notes text check (notes is null or char_length(notes) <= 2000),
  updated_at timestamptz not null default now()
);

-- 3. Payments: Paystack (card, transfer, USSD) and manual ones the owner records (e.g. bank transfer).
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete set null,
  reference text not null unique,
  amount_kobo bigint not null check (amount_kobo > 0),
  currency text not null default 'NGN',
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  method text not null default 'paystack' check (method in ('paystack', 'manual')),
  channel text,
  months int not null default 1 check (months between 1 and 36),
  period_start timestamptz,
  period_end timestamptz,
  paid_at timestamptz,
  note text check (note is null or char_length(note) <= 500),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists payments_firm_idx on public.payments (firm_id, created_at desc);

-- Firms that signed up before billing existed get a fresh 14-day trial from today, so nobody is cut off by surprise.
insert into public.firm_subscriptions (firm_id, status, trial_ends_at)
select f.id, 'trial', now() + interval '14 days' from public.firms f
on conflict (firm_id) do nothing;

alter table public.plans enable row level security;
alter table public.firm_subscriptions enable row level security;
alter table public.payments enable row level security;

-- Signed-in people can see the plans on offer; firms see their own subscription; firm admins see their payments.
drop policy if exists plans_read on public.plans;
create policy plans_read on public.plans for select to authenticated using (active);
drop policy if exists firm_subscriptions_read on public.firm_subscriptions;
create policy firm_subscriptions_read on public.firm_subscriptions for select to authenticated
  using (firm_id = public.my_firm_id());
drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select to authenticated
  using (firm_id = public.my_firm_id() and public.my_role() = 'admin');
-- No insert, update or delete policies: only the server can write these tables.

-- 4. Usage figures for the owner dashboard, one row per firm. Only the server can call it.
create or replace function public.owner_firm_stats()
returns table (firm_id uuid, members int, pending int, matters int, upcoming int, last_activity timestamptz)
language sql stable security definer set search_path = public as $$
  select f.id,
    (select count(*)::int from public.profiles p where p.firm_id = f.id and coalesce(p.status, 'active') = 'active'),
    (select count(*)::int from public.profiles p where p.firm_id = f.id and p.status = 'pending'),
    (select count(*)::int from public.matters m where m.firm_id = f.id),
    (select count(*)::int from public.events e where e.firm_id = f.id and e.starts_at >= now()),
    greatest(
      (select max(a.created_at) from public.activity_log a where a.firm_id = f.id),
      (select max(e.created_at) from public.events e where e.firm_id = f.id)
    )
  from public.firms f;
$$;
revoke execute on function public.owner_firm_stats() from public, anon, authenticated;
grant execute on function public.owner_firm_stats() to service_role;
