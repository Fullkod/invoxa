-- =============================================================================
-- Invoxa — Per-company security: RLS, Storage and SQL functions
-- (PRP-001, Phase 2, INV0004)
-- =============================================================================
-- Every admin check becomes "admin of THIS row's company":
--   is_company_admin(company_id) = caller is admin of that company, or the
--   super_admin currently operating in it (profiles.active_company_id).
-- Self clauses (user_id = auth.uid()) are already tenant-safe and stay.
-- Storage keeps its paths ({user_id}/...): the admin policy resolves the
-- company through the owner's profile, so no file has to move.
-- Policies are rebuilt from the definitions live in production on 2026-11-04.
-- =============================================================================

-- 1. Helpers --------------------------------------------------------------------
create or replace function is_super_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'super_admin' from profiles where id = check_user_id),
    false
  );
$$;

create or replace function is_company_admin(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_company_id is not null and exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and (
        (p.role = 'admin' and p.company_id = p_company_id)
        or (p.role = 'super_admin' and p.active_company_id = p_company_id)
      )
  );
$$;

-- Kept for existing callers: "admin of the company I am working in".
create or replace function is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role = 'admin'
            or (p.role = 'super_admin' and p.active_company_id is not null)
     from profiles p where p.id = check_user_id),
    false
  );
$$;

-- Super admin falls back to the company they operate in (e.g. notifications).
create or replace function set_company_from_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
begin
  select coalesce(company_id, active_company_id) into v_company
  from profiles where id = new.user_id;
  if v_company is null then
    raise exception 'El usuario % no pertenece a ninguna empresa', new.user_id;
  end if;
  new.company_id := v_company;
  return new;
end;
$$;

-- Only the super admin has no company, and a super admin has none.
alter table profiles
  add constraint profiles_company_matches_role check (
    (role = 'super_admin' and company_id is null)
    or (role <> 'super_admin' and company_id is not null)
  );

-- 2. companies: the super admin sees and manages all ----------------------------
drop policy if exists "companies_member_read" on companies;
create policy "companies_member_read"
  on companies for select
  to authenticated
  using (id = current_company_id() or is_super_admin());

drop policy if exists "companies_admin_update" on companies;
create policy "companies_admin_update"
  on companies for update
  to authenticated
  using (is_company_admin(id) or is_super_admin())
  with check (is_company_admin(id) or is_super_admin());

create policy "companies_super_admin_insert"
  on companies for insert
  to authenticated
  with check (is_super_admin());

-- 3. Tables + Storage -------------------------------------------------------------
drop policy if exists "compensation_admin_delete" on compensation_settings;
create policy "compensation_admin_delete"
  on compensation_settings for delete
  to public
  using (is_company_admin(company_id));

drop policy if exists "compensation_admin_insert" on compensation_settings;
create policy "compensation_admin_insert"
  on compensation_settings for insert
  to public
  with check (is_company_admin(company_id));

drop policy if exists "compensation_admin_update" on compensation_settings;
create policy "compensation_admin_update"
  on compensation_settings for update
  to public
  using (is_company_admin(company_id))
  with check (is_company_admin(company_id));

drop policy if exists "compensation_self_or_admin_read" on compensation_settings;
create policy "compensation_self_or_admin_read"
  on compensation_settings for select
  to public
  using (((user_id = auth.uid()) OR is_company_admin(company_id)));

drop policy if exists "email_logs_admin_insert" on email_logs;
create policy "email_logs_admin_insert"
  on email_logs for insert
  to public
  with check (is_company_admin(company_id));

drop policy if exists "email_logs_admin_read" on email_logs;
create policy "email_logs_admin_read"
  on email_logs for select
  to public
  using (is_company_admin(company_id));

drop policy if exists "invoice_items_admin_delete" on invoice_items;
create policy "invoice_items_admin_delete"
  on invoice_items for delete
  to public
  using (is_company_admin(company_id));

drop policy if exists "invoice_items_admin_insert" on invoice_items;
create policy "invoice_items_admin_insert"
  on invoice_items for insert
  to public
  with check (is_company_admin(company_id));

drop policy if exists "invoice_items_admin_update" on invoice_items;
create policy "invoice_items_admin_update"
  on invoice_items for update
  to public
  using (is_company_admin(company_id))
  with check (is_company_admin(company_id));

drop policy if exists "invoice_items_self_or_admin_read" on invoice_items;
create policy "invoice_items_self_or_admin_read"
  on invoice_items for select
  to public
  using ((is_company_admin(company_id) OR (EXISTS ( SELECT 1
      FROM invoices i
      WHERE ((i.id = invoice_items.invoice_id) AND (i.user_id = auth.uid()))))));

drop policy if exists "invoice_number_requests_admin_delete" on invoice_number_change_requests;
create policy "invoice_number_requests_admin_delete"
  on invoice_number_change_requests for delete
  to public
  using (is_company_admin(company_id));

drop policy if exists "invoice_number_requests_admin_update" on invoice_number_change_requests;
create policy "invoice_number_requests_admin_update"
  on invoice_number_change_requests for update
  to public
  using (is_company_admin(company_id))
  with check (is_company_admin(company_id));

drop policy if exists "invoice_number_requests_self_or_admin_read" on invoice_number_change_requests;
create policy "invoice_number_requests_self_or_admin_read"
  on invoice_number_change_requests for select
  to public
  using ((is_company_admin(company_id) OR (requested_by = auth.uid()) OR (EXISTS ( SELECT 1
      FROM invoices i
      WHERE ((i.id = invoice_number_change_requests.invoice_id) AND (i.user_id = auth.uid()))))));

drop policy if exists "invoice_number_requests_user_insert_for_own" on invoice_number_change_requests;
create policy "invoice_number_requests_user_insert_for_own"
  on invoice_number_change_requests for insert
  to public
  with check ((is_company_admin(company_id) OR ((requested_by = auth.uid()) AND (requested_by_role = 'user'::user_role) AND (status = 'pending'::invoice_number_change_status) AND (EXISTS ( SELECT 1
      FROM invoices i
      WHERE ((i.id = invoice_number_change_requests.invoice_id) AND (i.user_id = auth.uid())))))));

drop policy if exists "invoice_number_history_admin_insert" on invoice_number_history;
create policy "invoice_number_history_admin_insert"
  on invoice_number_history for insert
  to public
  with check (is_company_admin(company_id));

drop policy if exists "invoice_number_history_self_or_admin_read" on invoice_number_history;
create policy "invoice_number_history_self_or_admin_read"
  on invoice_number_history for select
  to public
  using ((is_company_admin(company_id) OR (EXISTS ( SELECT 1
      FROM invoices i
      WHERE ((i.id = invoice_number_history.invoice_id) AND (i.user_id = auth.uid()))))));

drop policy if exists "invoice_requests_admin_delete" on invoice_requests;
create policy "invoice_requests_admin_delete"
  on invoice_requests for delete
  to public
  using (is_company_admin(company_id));

drop policy if exists "invoice_requests_admin_insert" on invoice_requests;
create policy "invoice_requests_admin_insert"
  on invoice_requests for insert
  to public
  with check (is_company_admin(company_id));

drop policy if exists "invoice_requests_admin_update" on invoice_requests;
create policy "invoice_requests_admin_update"
  on invoice_requests for update
  to public
  using (is_company_admin(company_id))
  with check (is_company_admin(company_id));

drop policy if exists "invoice_requests_self_or_admin_read" on invoice_requests;
create policy "invoice_requests_self_or_admin_read"
  on invoice_requests for select
  to public
  using (((user_id = auth.uid()) OR is_company_admin(company_id)));

drop policy if exists "invoices_admin_delete" on invoices;
create policy "invoices_admin_delete"
  on invoices for delete
  to public
  using (is_company_admin(company_id));

drop policy if exists "invoices_admin_insert" on invoices;
create policy "invoices_admin_insert"
  on invoices for insert
  to public
  with check (is_company_admin(company_id));

drop policy if exists "invoices_admin_update" on invoices;
create policy "invoices_admin_update"
  on invoices for update
  to public
  using (is_company_admin(company_id))
  with check (is_company_admin(company_id));

drop policy if exists "invoices_self_or_admin_read" on invoices;
create policy "invoices_self_or_admin_read"
  on invoices for select
  to public
  using (((user_id = auth.uid()) OR is_company_admin(company_id)));

drop policy if exists "notifications_admin_update" on notifications;
create policy "notifications_admin_update"
  on notifications for update
  to public
  using (is_company_admin(company_id))
  with check (is_company_admin(company_id));

drop policy if exists "notifications_self_mark_read" on notifications;
create policy "notifications_self_mark_read"
  on notifications for update
  to public
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));

drop policy if exists "notifications_self_or_admin_read" on notifications;
create policy "notifications_self_or_admin_read"
  on notifications for select
  to public
  using (((user_id = auth.uid()) OR is_company_admin(company_id)));

drop policy if exists "profiles_admin_delete" on profiles;
create policy "profiles_admin_delete"
  on profiles for delete
  to public
  using (is_company_admin(company_id));

drop policy if exists "profiles_admin_full_update" on profiles;
create policy "profiles_admin_full_update"
  on profiles for update
  to public
  using (is_company_admin(company_id))
  with check ((is_company_admin(company_id) AND (role <> 'super_admin'::user_role)));

drop policy if exists "profiles_admin_insert" on profiles;
create policy "profiles_admin_insert"
  on profiles for insert
  to public
  with check ((is_company_admin(company_id) AND (role <> 'super_admin'::user_role)));

drop policy if exists "profiles_self_or_admin_read" on profiles;
create policy "profiles_self_or_admin_read"
  on profiles for select
  to public
  using (((id = auth.uid()) OR is_company_admin(company_id)));

drop policy if exists "profiles_self_update_safe_fields" on profiles;
create policy "profiles_self_update_safe_fields"
  on profiles for update
  to public
  using ((id = auth.uid()))
  with check ((((id = auth.uid()) AND (role = ( SELECT p2.role
      FROM profiles p2
      WHERE (p2.id = auth.uid()))) AND (status = ( SELECT p2.status
      FROM profiles p2
      WHERE (p2.id = auth.uid()))))
      AND (NOT (company_id IS DISTINCT FROM ( SELECT p2.company_id
         FROM profiles p2 WHERE (p2.id = auth.uid()))))));

drop policy if exists "projects_admin_delete" on projects;
create policy "projects_admin_delete"
  on projects for delete
  to public
  using (is_company_admin(company_id));

drop policy if exists "projects_admin_insert" on projects;
create policy "projects_admin_insert"
  on projects for insert
  to public
  with check (is_company_admin(company_id));

drop policy if exists "projects_admin_update" on projects;
create policy "projects_admin_update"
  on projects for update
  to public
  using (is_company_admin(company_id))
  with check (is_company_admin(company_id));

drop policy if exists "projects_authenticated_read" on projects;
create policy "projects_authenticated_read"
  on projects for select
  to authenticated
  using ((company_id = current_company_id()));

drop policy if exists "tasks_self_delete_unbilled" on tasks;
create policy "tasks_self_delete_unbilled"
  on tasks for delete
  to public
  using ((((user_id = auth.uid()) AND (invoice_id IS NULL)) OR is_company_admin(company_id)));

drop policy if exists "tasks_self_insert" on tasks;
create policy "tasks_self_insert"
  on tasks for insert
  to public
  with check (((user_id = auth.uid()) OR is_company_admin(company_id)));

drop policy if exists "tasks_self_or_admin_read" on tasks;
create policy "tasks_self_or_admin_read"
  on tasks for select
  to public
  using (((user_id = auth.uid()) OR is_company_admin(company_id)));

drop policy if exists "tasks_self_update_unbilled" on tasks;
create policy "tasks_self_update_unbilled"
  on tasks for update
  to public
  using ((((user_id = auth.uid()) AND (invoice_id IS NULL)) OR is_company_admin(company_id)))
  with check ((((user_id = auth.uid()) AND (invoice_id IS NULL)) OR is_company_admin(company_id)));

drop policy if exists "billing_profiles_admin_delete" on user_billing_profiles;
create policy "billing_profiles_admin_delete"
  on user_billing_profiles for delete
  to public
  using (is_company_admin(company_id));

drop policy if exists "billing_profiles_self_or_admin_insert" on user_billing_profiles;
create policy "billing_profiles_self_or_admin_insert"
  on user_billing_profiles for insert
  to public
  with check (((user_id = auth.uid()) OR is_company_admin(company_id)));

drop policy if exists "billing_profiles_self_or_admin_read" on user_billing_profiles;
create policy "billing_profiles_self_or_admin_read"
  on user_billing_profiles for select
  to public
  using (((user_id = auth.uid()) OR is_company_admin(company_id)));

drop policy if exists "billing_profiles_self_or_admin_update" on user_billing_profiles;
create policy "billing_profiles_self_or_admin_update"
  on user_billing_profiles for update
  to public
  using (((user_id = auth.uid()) OR is_company_admin(company_id)))
  with check (((user_id = auth.uid()) OR is_company_admin(company_id)));

drop policy if exists "assignments_admin_delete" on user_project_assignments;
create policy "assignments_admin_delete"
  on user_project_assignments for delete
  to public
  using (is_company_admin(company_id));

drop policy if exists "assignments_admin_insert" on user_project_assignments;
create policy "assignments_admin_insert"
  on user_project_assignments for insert
  to public
  with check (is_company_admin(company_id));

drop policy if exists "assignments_admin_update" on user_project_assignments;
create policy "assignments_admin_update"
  on user_project_assignments for update
  to public
  using (is_company_admin(company_id))
  with check (is_company_admin(company_id));

drop policy if exists "assignments_self_or_admin_read" on user_project_assignments;
create policy "assignments_self_or_admin_read"
  on user_project_assignments for select
  to public
  using (((user_id = auth.uid()) OR is_company_admin(company_id)));

drop policy if exists "invoices_pdf_admin_read" on storage.objects;
create policy "invoices_pdf_admin_read"
  on storage.objects for select
  to authenticated
  using (((bucket_id = 'invoices'::text) AND (EXISTS ( SELECT 1
      FROM public.profiles p
      WHERE (((p.id)::text = (storage.foldername(objects.name))[1])
        AND public.is_company_admin(p.company_id))))));

drop policy if exists "invoices_pdf_owner_read" on storage.objects;
create policy "invoices_pdf_owner_read"
  on storage.objects for select
  to authenticated
  using (((bucket_id = 'invoices'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

drop policy if exists "reports_pdf_admin_read" on storage.objects;
create policy "reports_pdf_admin_read"
  on storage.objects for select
  to authenticated
  using (((bucket_id = 'reports'::text) AND (EXISTS ( SELECT 1
      FROM public.profiles p
      WHERE (((p.id)::text = (storage.foldername(objects.name))[1])
        AND public.is_company_admin(p.company_id))))));

drop policy if exists "reports_pdf_owner_read" on storage.objects;
create policy "reports_pdf_owner_read"
  on storage.objects for select
  to authenticated
  using (((bucket_id = 'reports'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

-- 4. Numbering: company prefix, uniqueness inside the company -------------------
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
  v_prefix text;
  v_next_seq integer;
begin
  perform pg_advisory_xact_lock(hashtext('invoice_number:' || p_user_id::text));

  select p.user_code, c.invoice_prefix
  into v_user_code, v_prefix
  from profiles p
  join companies c on c.id = p.company_id
  where p.id = p_user_id;

  if v_prefix is null then
    raise exception 'El usuario % no pertenece a ninguna empresa', p_user_id;
  end if;

  if v_user_code is null or v_user_code = '' then
    v_user_code := upper(substring(replace(p_user_id::text, '-', ''), 1, 6));
  end if;

  -- Counter restarts every year.
  select coalesce(max(i.user_invoice_sequence), 0) + 1
  into v_next_seq
  from invoices i
  where i.user_id = p_user_id
    and i.invoice_year = p_year;

  invoice_number := v_prefix || '-' || v_user_code || '-' || p_year::text || '-' ||
    lpad(v_next_seq::text, 4, '0');
  sequence_number := v_next_seq;
  return next;
end;
$$;

create or replace function apply_invoice_number_change(
  p_invoice_id uuid,
  p_new_invoice_number text,
  p_changed_by uuid,
  p_change_request_id uuid default null,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice invoices%rowtype;
  v_existing_count integer;
begin
  select * into v_invoice from invoices where id = p_invoice_id for update;

  if not found then
    raise exception 'Invoice % not found', p_invoice_id;
  end if;

  if v_invoice.invoice_number = p_new_invoice_number then
    return v_invoice.id;
  end if;

  select count(*) into v_existing_count
  from invoices
  where invoice_number = p_new_invoice_number
    and company_id = v_invoice.company_id
    and id <> p_invoice_id;

  if v_existing_count > 0 then
    raise exception
      'Invoice number % already exists', p_new_invoice_number;
  end if;

  insert into invoice_number_history (
    invoice_id,
    previous_invoice_number,
    new_invoice_number,
    change_request_id,
    changed_by,
    reason
  ) values (
    v_invoice.id,
    v_invoice.invoice_number,
    p_new_invoice_number,
    p_change_request_id,
    p_changed_by,
    p_reason
  );

  update invoices
  set invoice_number = p_new_invoice_number
  where id = v_invoice.id;

  return v_invoice.id;
end;
$$;

-- 5. Notifications go only to the admins of the same company --------------------
CREATE OR REPLACE FUNCTION public.notify_on_invoice_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_admin_id uuid;
  v_period text;
begin
  if tg_op = 'INSERT' then
    v_period := format_period(new.period_start, new.period_end);
    -- Avisar a todos los admins activos que hay una factura nueva por revisar.
    for v_admin_id in
      select id from profiles where role = 'admin' and status = 'active'
        and company_id = new.company_id
    loop
      perform notify_user(
        v_admin_id,
        'invoice_created',
        'Nueva factura generada',
        'La factura ' || new.invoice_number || ' (' || v_period || ') está lista para revisión.',
        'invoices',
        new.id,
        jsonb_build_object(
          'invoice_number', new.invoice_number,
          'user_id', new.user_id,
          'period_start', new.period_start,
          'period_end', new.period_end,
          'total', new.total,
          'currency', new.currency
        )
      );
    end loop;
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    -- Avisar al dueño de la factura del cambio de estado.
    perform notify_user(
      new.user_id,
      'invoice_status_changed',
      'Tu factura cambió de estado',
      'La factura ' || new.invoice_number || ' pasó de ' || old.status || ' a ' || new.status || '.',
      'invoices',
      new.id,
      jsonb_build_object(
        'invoice_number', new.invoice_number,
        'previous_status', old.status,
        'new_status', new.status
      )
    );
    return new;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_invoice_number_change_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_admin_id uuid;
  v_invoice_owner uuid;
begin
  select user_id into v_invoice_owner
  from invoices where id = coalesce(new.invoice_id, old.invoice_id);

  if tg_op = 'INSERT' then
    if new.requested_by_role = 'user' then
      -- Notificar a todos los admins de la nueva solicitud.
      for v_admin_id in
        select id from profiles where role = 'admin' and status = 'active'
        and company_id = new.company_id
      loop
        perform notify_user(
          v_admin_id,
          'invoice_number_change_requested',
          'Nueva solicitud de cambio de consecutivo',
          'Hay una solicitud para cambiar ' || new.current_invoice_number ||
            ' por ' || new.requested_invoice_number || '.',
          'invoice_number_change_requests',
          new.id,
          jsonb_build_object(
            'invoice_id', new.invoice_id,
            'current_invoice_number', new.current_invoice_number,
            'requested_invoice_number', new.requested_invoice_number,
            'requested_by', new.requested_by
          )
        );
      end loop;
    else
      -- Cambio aplicado directamente por admin: avisar al dueño de la factura.
      if v_invoice_owner is not null and v_invoice_owner <> new.requested_by then
        perform notify_user(
          v_invoice_owner,
          'invoice_number_change_resolved',
          'Tu factura cambió de número',
          'El número de factura cambió de ' || new.current_invoice_number ||
            ' a ' || new.requested_invoice_number || '.',
          'invoice_number_change_requests',
          new.id,
          jsonb_build_object(
            'invoice_id', new.invoice_id,
            'current_invoice_number', new.current_invoice_number,
            'requested_invoice_number', new.requested_invoice_number,
            'status', new.status
          )
        );
      end if;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    -- Sólo notificamos resoluciones (approved / rejected / applied) al usuario
    -- que originó la solicitud. Si el solicitante fue admin no se notifica a
    -- sí mismo (ya lo hace el INSERT contra el dueño de la factura).
    if new.status in ('approved', 'rejected', 'applied')
       and new.requested_by_role = 'user' then
      perform notify_user(
        new.requested_by,
        'invoice_number_change_resolved',
        case new.status
          when 'approved' then 'Tu solicitud fue aprobada'
          when 'rejected' then 'Tu solicitud fue rechazada'
          when 'applied'  then 'El cambio de consecutivo fue aplicado'
        end,
        case
          when new.status = 'rejected' and new.review_notes is not null
            then 'Motivo: ' || new.review_notes
          else 'Solicitud para cambiar ' || new.current_invoice_number ||
               ' por ' || new.requested_invoice_number || '.'
        end,
        'invoice_number_change_requests',
        new.id,
        jsonb_build_object(
          'invoice_id', new.invoice_id,
          'previous_status', old.status,
          'new_status', new.status,
          'review_notes', new.review_notes
        )
      );
    end if;
    return new;
  end if;

  return new;
end;
$function$;
