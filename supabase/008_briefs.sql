-- C-Diary update 008: briefs and written addresses drafted with AI.
-- Run it in Supabase > SQL Editor after 007. Running it twice does no harm.

create table if not exists public.briefs (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  kind text not null check (char_length(kind) between 1 and 60),
  title text not null check (char_length(title) between 1 and 200),
  side text check (side is null or char_length(side) <= 60),
  issues text check (issues is null or char_length(issues) <= 4000),
  instructions text check (instructions is null or char_length(instructions) <= 8000),
  authorities text check (authorities is null or char_length(authorities) <= 20000),
  document_ids uuid[] not null default '{}',
  length text not null default 'standard' check (length in ('short', 'standard', 'full')),
  content text,
  previous_content text,
  status text not null default 'draft' check (status in ('draft', 'working', 'failed')),
  error text,
  model text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index if not exists briefs_matter_idx on public.briefs (matter_id, updated_at desc);

-- Firm, author and times are set by the database, not the browser.
create or replace function public.stamp_brief() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    select m.firm_id into new.firm_id from public.matters m where m.id = new.matter_id and m.firm_id = public.my_firm_id();
    if new.firm_id is null then raise exception 'Matter not found'; end if;
    new.created_by := auth.uid();
    new.created_at := now();
  else
    new.firm_id := old.firm_id;
    new.matter_id := old.matter_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  if auth.uid() is not null then new.updated_by := auth.uid(); end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists stamp_brief on public.briefs;
create trigger stamp_brief before insert or update on public.briefs
for each row execute function public.stamp_brief();

create or replace function public.audit_brief() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform log_activity(new.firm_id, 'created', 'brief', new.id, 'Started a draft: ' || new.title);
  elsif tg_op = 'DELETE' then
    perform log_activity(old.firm_id, 'deleted', 'brief', old.id, 'Deleted a draft: ' || old.title);
  end if;
  return null;
end $$;
drop trigger if exists audit_brief on public.briefs;
create trigger audit_brief after insert or delete on public.briefs
for each row execute function public.audit_brief();

alter table public.briefs enable row level security;

-- Everyone in the firm can read drafts; counsel (admin, partner, associate) write them;
-- the author or an admin/partner can delete one.
drop policy if exists briefs_read on public.briefs;
create policy briefs_read on public.briefs for select to authenticated
  using (firm_id = public.my_firm_id() and exists (select 1 from public.matters m where m.id = matter_id));
drop policy if exists briefs_insert on public.briefs;
create policy briefs_insert on public.briefs for insert to authenticated
  with check (public.my_role() in ('admin', 'partner', 'associate'));
drop policy if exists briefs_update on public.briefs;
create policy briefs_update on public.briefs for update to authenticated
  using (firm_id = public.my_firm_id() and public.my_role() in ('admin', 'partner', 'associate'))
  with check (firm_id = public.my_firm_id());
drop policy if exists briefs_delete on public.briefs;
create policy briefs_delete on public.briefs for delete to authenticated
  using (firm_id = public.my_firm_id() and (created_by = auth.uid() or public.my_role() in ('admin', 'partner')));
