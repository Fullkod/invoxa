-- =============================================================================
-- Invoxa — Task supervision per project (PRP-003, Phase 1)
-- =============================================================================
-- A supervisor (any member of the company) reviews the tasks of the members
-- they supervise in a given project: approve, or propose other hours. The
-- member accepts or rejects the proposal. An admin can also set the hours.
--
-- Privacy: supervisors get NO new RLS access to tasks or anything with money.
-- They read and act only through the SECURITY DEFINER RPCs below, which return
-- explicit columns (no rates, invoices or billing data).
--
--   project_supervisions   (project, supervisor, member) — N:M both ways
--   projects.requires_approval — only approved tasks are invoiced (default off)
--   tasks.review_*          — review state, only writable through the RPCs
--   list_review_tasks / review_task / respond_to_task_proposal
-- =============================================================================

-- 1. Opt-in per project -------------------------------------------------------
alter table projects
  add column if not exists requires_approval boolean not null default false;

-- 2. Who supervises whom, in which project --------------------------------------
create table project_supervisions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete restrict,
  project_id uuid not null references projects(id) on delete cascade,
  supervisor_id uuid not null references profiles(id) on delete cascade,
  member_id uuid not null references profiles(id) on delete cascade,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, supervisor_id, member_id),
  constraint project_supervisions_not_self check (supervisor_id <> member_id)
);

create index idx_project_supervisions_supervisor on project_supervisions(supervisor_id, project_id);
create index idx_project_supervisions_member on project_supervisions(member_id, project_id);
create index idx_project_supervisions_company on project_supervisions(company_id);

-- company_id comes from the project; supervisor and member must be in it, and
-- the member must be a current hourly member of the project.
create or replace function check_project_supervision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
begin
  select company_id into v_company from projects where id = new.project_id;
  if v_company is null then
    raise exception 'Proyecto no encontrado';
  end if;
  new.company_id := v_company;
  new.created_by := coalesce(new.created_by, auth.uid());

  if not exists (
    select 1 from profiles
    where id = new.supervisor_id and company_id = v_company and status <> 'inactive'
  ) then
    raise exception 'El responsable debe ser un usuario activo de la misma empresa';
  end if;

  if not exists (
    select 1
    from user_project_assignments upa
    join compensation_settings cs
      on cs.user_id = upa.user_id and cs.project_id = upa.project_id
    where upa.user_id = new.member_id
      and upa.project_id = new.project_id
      and upa.is_current
      and cs.is_active
      and cs.payment_type = 'hourly'
  ) then
    raise exception 'Solo se puede supervisar a miembros actuales del proyecto que cobran por hora';
  end if;

  return new;
end;
$$;

create trigger project_supervisions_check
  before insert or update on project_supervisions
  for each row execute function check_project_supervision();

alter table project_supervisions enable row level security;

create policy "supervisions_admin_or_party_read"
  on project_supervisions for select
  to authenticated
  using (is_company_admin(company_id) or supervisor_id = auth.uid() or member_id = auth.uid());

create policy "supervisions_admin_insert"
  on project_supervisions for insert
  to authenticated
  with check (is_company_admin(company_id));

create policy "supervisions_admin_delete"
  on project_supervisions for delete
  to authenticated
  using (is_company_admin(company_id));

revoke all on project_supervisions from anon, authenticated;
grant select, insert, delete on project_supervisions to authenticated;

-- 3. Review state on tasks -------------------------------------------------------
alter table tasks
  add column if not exists review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'changes_proposed')),
  add column if not exists proposed_hours numeric(6, 2)
    check (proposed_hours is null or (proposed_hours > 0 and proposed_hours <= 24)),
  add column if not exists review_comment text check (length(review_comment) <= 1000),
  add column if not exists response_comment text check (length(response_comment) <= 1000),
  add column if not exists reviewed_by uuid references profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

create index if not exists idx_tasks_project_review on tasks(project_id, review_status);

-- Tasks already invoiced count as approved. updated_at stays as it was.
alter table tasks disable trigger tasks_set_updated_at;
update tasks set review_status = 'approved' where invoice_id is not null;
alter table tasks enable trigger tasks_set_updated_at;

-- Review fields change only inside the review RPCs (flag invoxa.review_rpc).
-- Editing the content of a reviewed task sends it back to 'pending'.
create or replace function guard_task_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('invoxa.review_rpc', true), '') = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.review_status := 'pending';
    new.proposed_hours := null;
    new.review_comment := null;
    new.response_comment := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    return new;
  end if;

  new.review_status := old.review_status;
  new.proposed_hours := old.proposed_hours;
  new.review_comment := old.review_comment;
  new.response_comment := old.response_comment;
  new.reviewed_by := old.reviewed_by;
  new.reviewed_at := old.reviewed_at;

  if (new.hours, new.project_id, new.task_date, new.name, new.description)
     is distinct from (old.hours, old.project_id, old.task_date, old.name, old.description)
     and old.review_status <> 'pending' then
    new.review_status := 'pending';
    new.proposed_hours := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;

  return new;
end;
$$;

create trigger tasks_guard_review
  before insert or update on tasks
  for each row execute function guard_task_review();

-- 4. Notify supervisors when a supervised member logs hours ---------------------
-- 8.00 -> '8', 7.50 -> '7.5'
create or replace function fmt_hours(p numeric)
returns text
language sql
immutable
set search_path = public
as $$
  select rtrim(rtrim(round(p, 2)::numeric(8, 2)::text, '0'), '.');
$$;

create or replace function notify_supervisors_on_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supervisor uuid;
  v_member text;
  v_project text;
begin
  select coalesce(full_name, user_code, 'Un colaborador') into v_member from profiles where id = new.user_id;
  select name into v_project from projects where id = new.project_id;

  for v_supervisor in
    select supervisor_id from project_supervisions
    where project_id = new.project_id and member_id = new.user_id
  loop
    perform notify_user(
      v_supervisor,
      'task_review_requested',
      'Horas por revisar',
      v_member || ' registró ' || fmt_hours(new.hours) || ' h en ' || v_project ||
        ' (' || to_char(new.task_date, 'YYYY-MM-DD') || '): ' || new.name,
      'task_review',
      new.id,
      jsonb_build_object('project_id', new.project_id, 'member_id', new.user_id,
                         'hours', new.hours, 'task_date', new.task_date)
    );
  end loop;
  return new;
end;
$$;

create trigger tasks_notify_supervisors
  after insert on tasks
  for each row execute function notify_supervisors_on_task();

-- 5. RPCs for reviewers and members ------------------------------------------------
-- Tasks the caller may review: all hourly tasks of their company if admin, or
-- those of the members they supervise in that project. Never their own.
create or replace function list_review_tasks(
  p_project_id uuid default null,
  p_status text default null,
  p_from date default null,
  p_to date default null
)
returns table (
  id uuid,
  project_id uuid,
  project_name text,
  member_id uuid,
  member_name text,
  task_date date,
  hours numeric,
  name text,
  description text,
  observations text,
  review_status text,
  proposed_hours numeric,
  review_comment text,
  response_comment text,
  reviewed_by_name text,
  reviewed_at timestamptz,
  billed boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id, t.project_id, p.name, t.user_id, coalesce(m.full_name, m.user_code, 'Colaborador'),
    t.task_date, t.hours, t.name, t.description, t.observations,
    t.review_status, t.proposed_hours, t.review_comment, t.response_comment,
    r.full_name, t.reviewed_at, t.invoice_id is not null, t.created_at
  from tasks t
  join projects p on p.id = t.project_id
  join profiles m on m.id = t.user_id
  left join profiles r on r.id = t.reviewed_by
  where auth.uid() is not null
    and t.user_id <> auth.uid()
    and (
      is_company_admin(t.company_id)
      or exists (
        select 1 from project_supervisions s
        where s.supervisor_id = auth.uid()
          and s.project_id = t.project_id
          and s.member_id = t.user_id
          and s.company_id = t.company_id
      )
    )
    and exists (
      select 1 from compensation_settings cs
      where cs.user_id = t.user_id and cs.project_id = t.project_id
        and cs.is_active and cs.payment_type = 'hourly'
    )
    and (p_project_id is null or t.project_id = p_project_id)
    and (p_status is null or t.review_status = p_status)
    and (p_from is null or t.task_date >= p_from)
    and (p_to is null or t.task_date <= p_to)
  order by t.task_date desc, t.created_at desc
  limit 500;
$$;

-- p_action: 'approve' | 'propose' (supervisor or admin) | 'set' (admin only:
-- change the hours and approve). Returns the new review_status.
create or replace function review_task(
  p_task_id uuid,
  p_action text,
  p_hours numeric default null,
  p_comment text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task tasks%rowtype;
  v_is_admin boolean;
  v_comment text := nullif(trim(coalesce(p_comment, '')), '');
  v_status text;
  v_project text;
  v_title text;
  v_body text;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Tarea no encontrada';
  end if;

  v_is_admin := is_company_admin(v_task.company_id);
  if not v_is_admin and not exists (
    select 1 from project_supervisions s
    where s.supervisor_id = auth.uid()
      and s.project_id = v_task.project_id
      and s.member_id = v_task.user_id
      and s.company_id = v_task.company_id
  ) then
    raise exception 'Tarea no encontrada';
  end if;

  if v_task.user_id = auth.uid() then
    raise exception 'No puedes revisar tus propias tareas';
  end if;
  if v_task.invoice_id is not null then
    raise exception 'La tarea ya está facturada';
  end if;
  if v_comment is not null and length(v_comment) > 1000 then
    raise exception 'El comentario admite hasta 1000 caracteres';
  end if;
  if p_action in ('propose', 'set') and (p_hours is null or p_hours < 0.25 or p_hours > 24) then
    raise exception 'Las horas deben estar entre 0.25 y 24';
  end if;

  perform set_config('invoxa.review_rpc', 'on', true);

  if p_action = 'approve' then
    update tasks set
      review_status = 'approved', proposed_hours = null, review_comment = v_comment,
      reviewed_by = auth.uid(), reviewed_at = now()
    where id = v_task.id;
    v_status := 'approved';
  elsif p_action = 'propose' then
    if p_hours = v_task.hours then
      raise exception 'Propón unas horas distintas o aprueba la tarea';
    end if;
    update tasks set
      review_status = 'changes_proposed', proposed_hours = p_hours, review_comment = v_comment,
      response_comment = null, reviewed_by = auth.uid(), reviewed_at = now()
    where id = v_task.id;
    v_status := 'changes_proposed';
  elsif p_action = 'set' then
    if not v_is_admin then
      raise exception 'Solo un admin puede cambiar las horas directamente';
    end if;
    update tasks set
      hours = p_hours, review_status = 'approved', proposed_hours = null, review_comment = v_comment,
      reviewed_by = auth.uid(), reviewed_at = now()
    where id = v_task.id;
    v_status := 'approved';
  else
    raise exception 'Acción no válida';
  end if;

  perform set_config('invoxa.review_rpc', 'off', true);

  select name into v_project from projects where id = v_task.project_id;
  if v_status = 'approved' then
    v_title := 'Tarea aprobada';
    v_body := '«' || v_task.name || '» (' || v_project || ', ' || to_char(v_task.task_date, 'YYYY-MM-DD') || ') fue aprobada';
    if p_action = 'set' then
      v_body := v_body || ' con ' || fmt_hours(p_hours) || ' h';
    end if;
    v_body := v_body || '.';
  else
    v_title := 'Te proponen otras horas';
    v_body := '«' || v_task.name || '» (' || v_project || '): ' ||
      fmt_hours(p_hours) || ' h en vez de ' || fmt_hours(v_task.hours) || ' h.';
  end if;
  if v_comment is not null then
    v_body := v_body || ' Comentario: ' || v_comment;
  end if;

  perform notify_user(
    v_task.user_id, 'task_reviewed', v_title, v_body, 'tasks', v_task.id,
    jsonb_build_object('review_status', v_status, 'proposed_hours', p_hours)
  );

  return v_status;
end;
$$;

-- The member answers a proposal: accept (hours change, task approved) or
-- reject (back to pending, with a comment for the reviewer).
create or replace function respond_to_task_proposal(
  p_task_id uuid,
  p_accept boolean,
  p_comment text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task tasks%rowtype;
  v_comment text := nullif(trim(coalesce(p_comment, '')), '');
  v_status text;
  v_member text;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select * into v_task from tasks where id = p_task_id for update;
  if not found or v_task.user_id <> auth.uid() then
    raise exception 'Tarea no encontrada';
  end if;
  if v_task.review_status <> 'changes_proposed' or v_task.proposed_hours is null then
    raise exception 'Esta tarea no tiene una propuesta pendiente';
  end if;
  if v_task.invoice_id is not null then
    raise exception 'La tarea ya está facturada';
  end if;
  if v_comment is not null and length(v_comment) > 1000 then
    raise exception 'El comentario admite hasta 1000 caracteres';
  end if;
  if not p_accept and v_comment is null then
    raise exception 'Explica por qué no aceptas la propuesta';
  end if;

  perform set_config('invoxa.review_rpc', 'on', true);
  if p_accept then
    update tasks set
      hours = v_task.proposed_hours, review_status = 'approved', proposed_hours = null,
      response_comment = v_comment
    where id = v_task.id;
    v_status := 'approved';
  else
    update tasks set
      review_status = 'pending', proposed_hours = null, response_comment = v_comment
    where id = v_task.id;
    v_status := 'pending';
  end if;
  perform set_config('invoxa.review_rpc', 'off', true);

  select coalesce(full_name, user_code, 'El colaborador') into v_member from profiles where id = v_task.user_id;
  perform notify_user(
    v_task.reviewed_by,
    'task_proposal_answered',
    case when p_accept then 'Propuesta aceptada' else 'Propuesta rechazada' end,
    v_member || case when p_accept then ' aceptó ' else ' no aceptó ' end ||
      fmt_hours(v_task.proposed_hours) || ' h para «' || v_task.name || '».' ||
      case when v_comment is not null then ' Comentario: ' || v_comment else '' end,
    'task_review',
    v_task.id,
    jsonb_build_object('accepted', p_accept)
  );

  return v_status;
end;
$$;

revoke all on function list_review_tasks(uuid, text, date, date) from public, anon, authenticated;
revoke all on function review_task(uuid, text, numeric, text) from public, anon, authenticated;
revoke all on function respond_to_task_proposal(uuid, boolean, text) from public, anon, authenticated;
grant execute on function list_review_tasks(uuid, text, date, date) to authenticated;
grant execute on function review_task(uuid, text, numeric, text) to authenticated;
grant execute on function respond_to_task_proposal(uuid, boolean, text) to authenticated;

-- 6. Invoicing honours projects.requires_approval ---------------------------------
-- Same body as 20260506000007 plus: in projects that require approval, the
-- month cannot be invoiced while any task of the period is not approved
-- (otherwise those hours would never be billed: generation filters by period).
create or replace function generate_user_invoice(
  p_user_id uuid,
  p_period_start date,
  p_period_end date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer;
  v_invoice_number text;
  v_user_invoice_sequence integer;
  v_billing_complete boolean;
  v_currency text;
  v_currency_count integer;
  v_subtotal numeric := 0;
  v_invoice_id uuid;
  v_compensation record;
  v_total_hours numeric;
  v_project_subtotal numeric;
  v_project_count integer := 0;
  v_unapproved integer;
  v_unapproved_projects text;
begin
  if p_period_end < p_period_start then
    raise exception 'period_end debe ser igual o posterior a period_start';
  end if;

  -- 1. User active
  if not exists (
    select 1 from profiles where id = p_user_id and status = 'active'
  ) then
    raise exception 'Usuario no activo';
  end if;

  -- 2. Billing profile complete
  select
    legal_name is not null and length(legal_name) > 0
    and tax_id is not null and length(tax_id) > 0
    and billing_email is not null and length(billing_email) > 0
    and country is not null and length(country) > 0
  into v_billing_complete
  from user_billing_profiles
  where user_id = p_user_id;

  if v_billing_complete is null or v_billing_complete = false then
    raise exception 'Perfil de facturación incompleto';
  end if;

  -- 3. No existing non-cancelled invoice for this period
  if exists (
    select 1 from invoices
    where user_id = p_user_id
      and period_start = p_period_start
      and period_end = p_period_end
      and status <> 'cancelled'
  ) then
    raise exception 'Ya existe una factura para este periodo';
  end if;

  -- 3b. Projects that require approval: every task of the period approved
  select count(*), string_agg(distinct p.name, ', ')
  into v_unapproved, v_unapproved_projects
  from tasks t
  join projects p on p.id = t.project_id
  where t.user_id = p_user_id
    and p.requires_approval
    and t.task_date >= p_period_start
    and t.task_date <= p_period_end
    and t.invoice_id is null
    and t.review_status <> 'approved';

  if v_unapproved > 0 then
    raise exception 'Hay % tarea(s) sin aprobar en %. Deben revisarse antes de facturar el mes',
      v_unapproved, v_unapproved_projects;
  end if;

  -- 4. Currency consistency check
  select count(distinct cs.currency)
  into v_currency_count
  from compensation_settings cs
  inner join user_project_assignments upa
    on upa.user_id = cs.user_id
    and upa.project_id = cs.project_id
  where cs.user_id = p_user_id
    and cs.is_active = true
    and upa.is_current = true;

  if v_currency_count > 1 then
    raise exception 'Tienes proyectos con monedas distintas. Genera facturas separadas o unifica la moneda';
  end if;

  if v_currency_count = 0 then
    raise exception 'No tienes proyectos activos en este periodo';
  end if;

  select cs.currency
  into v_currency
  from compensation_settings cs
  inner join user_project_assignments upa
    on upa.user_id = cs.user_id
    and upa.project_id = cs.project_id
  where cs.user_id = p_user_id
    and cs.is_active = true
    and upa.is_current = true
  limit 1;

  -- 5. Generate invoice number
  v_year := extract(year from p_period_start)::integer;

  select t.invoice_number, t.sequence_number
  into v_invoice_number, v_user_invoice_sequence
  from next_invoice_number(p_user_id, v_year) t;

  -- 6. Insert invoice header
  insert into invoices (
    user_id,
    invoice_number,
    user_invoice_sequence,
    invoice_date,
    period_start,
    period_end,
    currency,
    subtotal,
    tax_amount,
    total,
    status
  )
  values (
    p_user_id,
    v_invoice_number,
    v_user_invoice_sequence,
    current_date,
    p_period_start,
    p_period_end,
    v_currency,
    0,
    0,
    0,
    'generated'
  )
  returning invoices.id into v_invoice_id;

  -- 7. Per-project items
  for v_compensation in (
    select
      cs.project_id,
      cs.payment_type,
      cs.hourly_rate,
      cs.monthly_rate,
      cs.currency,
      p.name as project_name,
      p.requires_approval
    from compensation_settings cs
    inner join user_project_assignments upa
      on upa.user_id = cs.user_id
      and upa.project_id = cs.project_id
    inner join projects p on p.id = cs.project_id
    where cs.user_id = p_user_id
      and cs.is_active = true
      and upa.is_current = true
    order by p.name
  ) loop
    if v_compensation.payment_type = 'hourly' then
      select coalesce(sum(t.hours), 0)
      into v_total_hours
      from tasks t
      where t.user_id = p_user_id
        and t.project_id = v_compensation.project_id
        and t.task_date >= p_period_start
        and t.task_date <= p_period_end
        and t.invoice_id is null
        and (not v_compensation.requires_approval or t.review_status = 'approved');

      if v_total_hours > 0 then
        v_project_subtotal := v_total_hours * v_compensation.hourly_rate;
        v_subtotal := v_subtotal + v_project_subtotal;
        v_project_count := v_project_count + 1;

        insert into invoice_items (
          invoice_id,
          project_id,
          payment_type,
          description,
          quantity,
          unit_price,
          total
        )
        values (
          v_invoice_id,
          v_compensation.project_id,
          'hourly',
          'Horas trabajadas — ' || v_compensation.project_name,
          v_total_hours,
          v_compensation.hourly_rate,
          v_project_subtotal
        );

        update tasks t
        set invoice_id = v_invoice_id
        where t.user_id = p_user_id
          and t.project_id = v_compensation.project_id
          and t.task_date >= p_period_start
          and t.task_date <= p_period_end
          and t.invoice_id is null
          and (not v_compensation.requires_approval or t.review_status = 'approved');
      end if;
    else
      v_project_subtotal := v_compensation.monthly_rate;
      v_subtotal := v_subtotal + v_project_subtotal;
      v_project_count := v_project_count + 1;

      insert into invoice_items (
        invoice_id,
        project_id,
        payment_type,
        description,
        quantity,
        unit_price,
        total
      )
      values (
        v_invoice_id,
        v_compensation.project_id,
        'fixed',
        'Tarifa mensual — ' || v_compensation.project_name,
        1,
        v_compensation.monthly_rate,
        v_project_subtotal
      );
    end if;
  end loop;

  if v_project_count = 0 then
    raise exception 'No hay horas registradas (o aprobadas, si el proyecto exige aprobación) ni proyectos con tarifa fija para facturar en este periodo';
  end if;

  update invoices
  set subtotal = v_subtotal,
      total = v_subtotal
  where invoices.id = v_invoice_id;

  return jsonb_build_object(
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'total', v_subtotal,
    'currency', v_currency
  );
end;
$$;

-- create or replace keeps the grants of 20261105000000; restate them anyway.
revoke all on function generate_user_invoice(uuid, date, date) from public, anon, authenticated;
grant execute on function generate_user_invoice(uuid, date, date) to service_role;

revoke all on function fmt_hours(numeric) from public, anon, authenticated;
