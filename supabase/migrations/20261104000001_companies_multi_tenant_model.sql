-- =============================================================================
-- Invoxa — Multi-company data model (PRP-001, Phase 1, INV0003)
-- =============================================================================
-- Additive only: no existing row is deleted or changed except to fill the new
-- company_id columns. The current app keeps working unchanged because
-- company_id is filled server-side by triggers:
--   - tables with user_id     -> company of that user's profile (always wins,
--                                the client cannot pick another company)
--   - invoice_* tables        -> company of the invoice
--   - projects                -> explicit value, else the caller's company
--   - profiles (new users)    -> raw_user_meta_data.company_id, else the only
--                                company while there is just one (transition;
--                                Phase 3 makes invite-user always send it)
--
-- RLS is NOT changed here (Phase 2). Informage Studios becomes the first
-- company with the recipient data that was hardcoded in generate-invoice-pdf.
-- =============================================================================

-- 1. companies ----------------------------------------------------------------
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text not null,
  tax_id text not null,
  address_line text,
  postal_code text,
  city text,
  region text,
  country text not null,
  billing_email text,
  invoice_prefix text not null,
  default_currency text not null default 'USD',
  logo_path text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_status_valid check (status in ('active', 'inactive')),
  constraint companies_invoice_prefix_valid check (invoice_prefix ~ '^[A-Z0-9]{1,8}$')
);

create unique index companies_invoice_prefix_key on companies (invoice_prefix);

create trigger companies_set_updated_at
  before update on companies
  for each row execute function set_updated_at();

alter table companies enable row level security;

-- Fixed id so later migrations and scripts can reference Informage directly.
insert into companies (
  id, name, legal_name, tax_id, address_line, postal_code, city, region,
  country, invoice_prefix, default_currency
) values (
  '5b1c2e0a-7d43-4f8e-9a61-3c0f5e2d9b17',
  'Informage Studios',
  'Informage Studios S.L.U.',
  'B-97776744',
  'C/Rei En Jaume, 2 – 1ª',
  '46138',
  'Rafelbunyol',
  'Valencia',
  'España',
  'INF',
  'USD'
);

-- 2. company_id columns + backfill --------------------------------------------
alter table profiles
  add column company_id uuid references companies(id) on delete restrict,
  -- Company the super admin is currently operating in (Phase 2+).
  add column active_company_id uuid references companies(id) on delete set null;

alter table projects                       add column company_id uuid references companies(id) on delete restrict;
alter table user_billing_profiles          add column company_id uuid references companies(id) on delete restrict;
alter table user_project_assignments       add column company_id uuid references companies(id) on delete restrict;
alter table compensation_settings          add column company_id uuid references companies(id) on delete restrict;
alter table tasks                          add column company_id uuid references companies(id) on delete restrict;
alter table invoices                       add column company_id uuid references companies(id) on delete restrict;
alter table invoice_items                  add column company_id uuid references companies(id) on delete restrict;
alter table invoice_requests               add column company_id uuid references companies(id) on delete restrict;
alter table invoice_number_change_requests add column company_id uuid references companies(id) on delete restrict;
alter table invoice_number_history         add column company_id uuid references companies(id) on delete restrict;
alter table notifications                  add column company_id uuid references companies(id) on delete restrict;
alter table email_logs                     add column company_id uuid references companies(id) on delete restrict;

update profiles                       set company_id = '5b1c2e0a-7d43-4f8e-9a61-3c0f5e2d9b17' where company_id is null;
update projects                       set company_id = '5b1c2e0a-7d43-4f8e-9a61-3c0f5e2d9b17' where company_id is null;
update user_billing_profiles          set company_id = '5b1c2e0a-7d43-4f8e-9a61-3c0f5e2d9b17' where company_id is null;
update user_project_assignments       set company_id = '5b1c2e0a-7d43-4f8e-9a61-3c0f5e2d9b17' where company_id is null;
update compensation_settings          set company_id = '5b1c2e0a-7d43-4f8e-9a61-3c0f5e2d9b17' where company_id is null;
update tasks                          set company_id = '5b1c2e0a-7d43-4f8e-9a61-3c0f5e2d9b17' where company_id is null;
update invoices                       set company_id = '5b1c2e0a-7d43-4f8e-9a61-3c0f5e2d9b17' where company_id is null;
update invoice_items                  set company_id = '5b1c2e0a-7d43-4f8e-9a61-3c0f5e2d9b17' where company_id is null;
update invoice_requests               set company_id = '5b1c2e0a-7d43-4f8e-9a61-3c0f5e2d9b17' where company_id is null;
update invoice_number_change_requests set company_id = '5b1c2e0a-7d43-4f8e-9a61-3c0f5e2d9b17' where company_id is null;
update invoice_number_history         set company_id = '5b1c2e0a-7d43-4f8e-9a61-3c0f5e2d9b17' where company_id is null;
update notifications                  set company_id = '5b1c2e0a-7d43-4f8e-9a61-3c0f5e2d9b17' where company_id is null;
update email_logs                     set company_id = '5b1c2e0a-7d43-4f8e-9a61-3c0f5e2d9b17' where company_id is null;

-- profiles.company_id stays nullable: the super admin has no company (the
-- constraint "only super_admin may have no company" comes in Phase 2, once the
-- enum value exists). email_logs stays nullable: rows are written by Edge
-- Functions with the service role and get their company in Phase 3.
alter table projects                       alter column company_id set not null;
alter table user_billing_profiles          alter column company_id set not null;
alter table user_project_assignments       alter column company_id set not null;
alter table compensation_settings          alter column company_id set not null;
alter table tasks                          alter column company_id set not null;
alter table invoices                       alter column company_id set not null;
alter table invoice_items                  alter column company_id set not null;
alter table invoice_requests               alter column company_id set not null;
alter table invoice_number_change_requests alter column company_id set not null;
alter table invoice_number_history         alter column company_id set not null;
alter table notifications                  alter column company_id set not null;

create index idx_profiles_company                on profiles(company_id);
create index idx_projects_company                on projects(company_id);
create index idx_billing_profiles_company        on user_billing_profiles(company_id);
create index idx_assignments_company             on user_project_assignments(company_id);
create index idx_compensation_company            on compensation_settings(company_id);
create index idx_tasks_company                   on tasks(company_id);
create index idx_invoices_company                on invoices(company_id);
create index idx_invoice_items_company           on invoice_items(company_id);
create index idx_invoice_requests_company        on invoice_requests(company_id);
create index idx_number_change_requests_company  on invoice_number_change_requests(company_id);
create index idx_number_history_company          on invoice_number_history(company_id);
create index idx_notifications_company           on notifications(company_id);
create index idx_email_logs_company              on email_logs(company_id);

-- 3. current_company_id() -------------------------------------------------------
-- Company of the caller: their own, or (super admin) the one they selected.
create or replace function current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p.company_id, p.active_company_id)
  from profiles p
  where p.id = auth.uid();
$$;

-- 4. Triggers that fill company_id ---------------------------------------------
create or replace function set_company_from_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
begin
  select company_id into v_company from profiles where id = new.user_id;
  if v_company is null then
    raise exception 'El usuario % no pertenece a ninguna empresa', new.user_id;
  end if;
  new.company_id := v_company;
  return new;
end;
$$;

create or replace function set_company_from_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select company_id into new.company_id from invoices where id = new.invoice_id;
  if new.company_id is null then
    raise exception 'La factura % no existe', new.invoice_id;
  end if;
  return new;
end;
$$;

create or replace function set_company_from_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.company_id is null then
    new.company_id := current_company_id();
  end if;
  -- Transition fallback while there is a single company (service-role calls
  -- have no auth.uid()). Removed in Phase 3.
  if new.company_id is null and (select count(*) from companies) = 1 then
    select id into new.company_id from companies limit 1;
  end if;
  if new.company_id is null then
    raise exception 'No se pudo determinar la empresa';
  end if;
  return new;
end;
$$;

create trigger user_billing_profiles_set_company
  before insert or update of user_id on user_billing_profiles
  for each row execute function set_company_from_user();
create trigger user_project_assignments_set_company
  before insert or update of user_id on user_project_assignments
  for each row execute function set_company_from_user();
create trigger compensation_settings_set_company
  before insert or update of user_id on compensation_settings
  for each row execute function set_company_from_user();
create trigger tasks_set_company
  before insert or update of user_id on tasks
  for each row execute function set_company_from_user();
create trigger invoices_set_company
  before insert or update of user_id on invoices
  for each row execute function set_company_from_user();
create trigger invoice_requests_set_company
  before insert or update of user_id on invoice_requests
  for each row execute function set_company_from_user();
create trigger notifications_set_company
  before insert or update of user_id on notifications
  for each row execute function set_company_from_user();

create trigger invoice_items_set_company
  before insert or update of invoice_id on invoice_items
  for each row execute function set_company_from_invoice();
create trigger invoice_number_change_requests_set_company
  before insert or update of invoice_id on invoice_number_change_requests
  for each row execute function set_company_from_invoice();
create trigger invoice_number_history_set_company
  before insert or update of invoice_id on invoice_number_history
  for each row execute function set_company_from_invoice();

create trigger projects_set_company
  before insert on projects
  for each row execute function set_company_from_session();
create trigger email_logs_set_company
  before insert on email_logs
  for each row execute function set_company_from_session();

-- Projects and their members must belong to the same company.
create or replace function check_project_company()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from projects
    where id = new.project_id and company_id = new.company_id
  ) then
    raise exception 'El proyecto no pertenece a la empresa del usuario';
  end if;
  return new;
end;
$$;

-- Trigger names sort after *_set_company so they run once company_id is set.
create trigger user_project_assignments_zcheck_project_company
  before insert or update of project_id, user_id on user_project_assignments
  for each row execute function check_project_company();
create trigger compensation_settings_zcheck_project_company
  before insert or update of project_id, user_id on compensation_settings
  for each row execute function check_project_company();
create trigger tasks_zcheck_project_company
  before insert or update of project_id, user_id on tasks
  for each row execute function check_project_company();
create trigger invoice_items_zcheck_project_company
  before insert or update of project_id, invoice_id on invoice_items
  for each row execute function check_project_company();

-- 5. New users get a company ----------------------------------------------------
-- Same body as 20260506000005 + company_id (metadata, or the single company).
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_role text;
  resolved_role user_role;
  initial_status user_status;
  meta_user_code text;
  meta_company uuid;
begin
  meta_role := new.raw_user_meta_data ->> 'role';
  meta_user_code := nullif(new.raw_user_meta_data ->> 'user_code', '');
  meta_company := nullif(new.raw_user_meta_data ->> 'company_id', '')::uuid;

  if meta_role = 'admin' then
    resolved_role := 'admin';
  else
    resolved_role := 'user';
  end if;

  if meta_company is null and (select count(*) from companies) = 1 then
    select id into meta_company from companies limit 1;
  end if;

  if new.email_confirmed_at is not null then
    initial_status := 'active';
  else
    initial_status := 'invited';
  end if;

  insert into profiles (id, email, full_name, role, status, user_code, company_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    resolved_role,
    initial_status,
    meta_user_code,
    meta_company
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- 6. Uniqueness per company -----------------------------------------------------
do $$
declare
  v_constraint text;
begin
  for v_constraint in
    select c.conname
    from pg_constraint c
    where c.contype = 'u'
      and (
        (c.conrelid = 'public.profiles'::regclass
          and c.conkey = array[(select attnum from pg_attribute
                                where attrelid = 'public.profiles'::regclass
                                  and attname = 'user_code')]::smallint[])
        or
        (c.conrelid = 'public.invoices'::regclass
          and c.conkey = array[(select attnum from pg_attribute
                                where attrelid = 'public.invoices'::regclass
                                  and attname = 'invoice_number')]::smallint[])
      )
  loop
    execute format(
      'alter table %s drop constraint %I',
      case when v_constraint like 'profiles%' then 'profiles' else 'invoices' end,
      v_constraint
    );
  end loop;
end;
$$;

alter table profiles add constraint profiles_company_user_code_key unique (company_id, user_code);
alter table invoices add constraint invoices_company_invoice_number_key unique (company_id, invoice_number);

-- 7. RLS for companies (members read their company; admins edit it) ------------
create policy "companies_member_read"
  on companies for select
  to authenticated
  using (id = current_company_id());

create policy "companies_admin_update"
  on companies for update
  to authenticated
  using (id = current_company_id() and is_admin())
  with check (id = current_company_id() and is_admin());
