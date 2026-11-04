-- =============================================================================
-- Invoxa — Super admin allowlist (PRP-001, Phase 4)
-- =============================================================================
-- Super admins are Fullkod accounts created by hand (Supabase dashboard →
-- Authentication → Add user), which carry no invitation metadata. An email in
-- this table becomes super_admin (no company) when its auth user is created;
-- any other user still needs company_id in the invitation.
-- No RLS policies: only the service role / SQL editor can read or change it.
-- =============================================================================

create table if not exists super_admin_allowlist (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

alter table super_admin_allowlist enable row level security;

insert into super_admin_allowlist (email) values ('invoxa@fullkod.com')
on conflict do nothing;

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
  if new.email_confirmed_at is not null then
    initial_status := 'active';
  else
    initial_status := 'invited';
  end if;

  if exists (select 1 from super_admin_allowlist where email = lower(new.email)) then
    insert into profiles (id, email, full_name, role, status, company_id)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data ->> 'full_name', 'Fullkod'),
      'super_admin',
      initial_status,
      null
    )
    on conflict (id) do nothing;
    return new;
  end if;

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
