-- =============================================================================
-- Invoxa — Remove the single-company transition fallbacks (PRP-001, Phase 3)
-- =============================================================================
-- invite-user and create-company now always send company_id in the invitation
-- metadata, and projects are created by an authenticated admin. The "if there
-- is only one company, use it" fallbacks from 20261104000001 would silently
-- put rows in the wrong company once a second company exists, so they go.
-- email_logs stays tolerant: a log row must never break the flow that writes it.
-- =============================================================================

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
  if new.company_id is null then
    raise exception 'No se pudo determinar la empresa';
  end if;
  return new;
end;
$$;

create or replace function set_email_log_company()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.company_id is null then
    new.company_id := current_company_id();
  end if;
  return new;
end;
$$;

drop trigger if exists email_logs_set_company on email_logs;
create trigger email_logs_set_company
  before insert on email_logs
  for each row execute function set_email_log_company();

-- New users must come with a company. A super admin is an existing user promoted by hand.
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

  if meta_company is null then
    raise exception 'La invitación no indica la empresa (company_id)';
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
