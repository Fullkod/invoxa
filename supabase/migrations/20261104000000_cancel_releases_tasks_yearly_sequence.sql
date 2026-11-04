-- =============================================================================
-- Invoxa — Cancelling an invoice releases its tasks + yearly invoice sequence
-- =============================================================================
-- PRP-001, Phase 0 (INV0002).
--
-- 1. When an invoice moves to 'cancelled', its tasks get invoice_id = null so
--    the hours can be billed again when the period is regenerated. Before this,
--    tasks stayed linked to the cancelled invoice and were silently skipped by
--    generate_user_invoice (which only picks tasks with invoice_id is null).
--
-- 2. The per-user invoice counter restarts every year. The year comes from the
--    invoice period (same year used in the invoice number INF-<code>-<year>-NNNN).
--    Uniqueness moves from (user_id, sequence) to (user_id, year, sequence).
--    Existing invoices keep their numbers; for the current year the next
--    number is unchanged (max of that year + 1).
-- =============================================================================

-- 1. Release tasks on cancel --------------------------------------------------
create or replace function release_tasks_on_invoice_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update tasks
    set invoice_id = null
    where invoice_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_release_tasks_on_cancel on invoices;
create trigger invoices_release_tasks_on_cancel
  after update of status on invoices
  for each row execute function release_tasks_on_invoice_cancel();

-- Backfill: invoices cancelled before this migration.
update tasks t
set invoice_id = null
from invoices i
where t.invoice_id = i.id
  and i.status = 'cancelled';

-- 2. Yearly sequence ----------------------------------------------------------
alter table invoices
  add column if not exists invoice_year integer
  generated always as (extract(year from period_start)::integer) stored;

do $$
declare
  v_constraint text;
begin
  -- Drop the original unique (user_id, user_invoice_sequence), whatever its name.
  select c.conname into v_constraint
  from pg_constraint c
  where c.conrelid = 'public.invoices'::regclass
    and c.contype = 'u'
    and (
      select array_agg(a.attname::text order by a.attname)
      from unnest(c.conkey) k
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k
    ) = array['user_id', 'user_invoice_sequence'];

  if v_constraint is not null then
    execute format('alter table invoices drop constraint %I', v_constraint);
  end if;
end;
$$;

alter table invoices
  add constraint invoices_user_year_sequence_key
  unique (user_id, invoice_year, user_invoice_sequence);

create or replace function next_invoice_number(
  p_user_id uuid,
  p_year integer
)
returns table (invoice_number text, sequence_number integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_code text;
  v_next_seq integer;
  v_invoice_number text;
begin
  -- Lock the per-user sequence space.
  perform pg_advisory_xact_lock(hashtext('invoice_number:' || p_user_id::text));

  select user_code into v_user_code
  from profiles
  where id = p_user_id;

  if v_user_code is null or v_user_code = '' then
    v_user_code := upper(substring(replace(p_user_id::text, '-', ''), 1, 6));
  end if;

  -- Counter restarts every year.
  select coalesce(max(user_invoice_sequence), 0) + 1
  into v_next_seq
  from invoices
  where user_id = p_user_id
    and invoice_year = p_year;

  v_invoice_number :=
    'INF-' || v_user_code || '-' || p_year::text || '-' ||
    lpad(v_next_seq::text, 4, '0');

  invoice_number := v_invoice_number;
  sequence_number := v_next_seq;
  return next;
end;
$$;
