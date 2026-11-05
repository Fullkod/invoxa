-- Run against the linked project: supabase db query --linked -f supabase/tests/supervision_test.sql
-- PRP-003 (task supervision). Creates its own company S with an admin, a
-- supervisor, two hourly members and a fixed one; everything is rolled back
-- by the final RAISE EXCEPTION. Any token ending in "!" is a failure.
do $$
declare
  c uuid := gen_random_uuid();
  adm uuid := gen_random_uuid();
  sup uuid := gen_random_uuid();
  mem1 uuid := gen_random_uuid();
  mem2 uuid := gen_random_uuid();
  fix uuid := gen_random_uuid();
  p1 uuid;
  p2 uuid;
  t1 uuid;
  t2 uuid;
  t3 uuid;
  n int;
  v text;
  num numeric;
  r text := '';
begin
  insert into companies (id, name, legal_name, tax_id, country, invoice_prefix)
  values (c, 'TestS', 'TestS SL', 'S1', 'ES', 'TSTS');

  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
  select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email,
         jsonb_build_object('role', u.role, 'company_id', c, 'user_code', u.code), now(), now(), now()
  from (values
    (adm, 's-adm@test.invalid', 'admin', 'SADM'),
    (sup, 's-sup@test.invalid', 'user', 'SSUP'),
    (mem1, 's-m1@test.invalid', 'user', 'SM1'),
    (mem2, 's-m2@test.invalid', 'user', 'SM2'),
    (fix, 's-fix@test.invalid', 'user', 'SFIX')
  ) as u(id, email, role, code);
  update profiles set status = 'active', full_name = upper(user_code) where id in (adm, sup, mem1, mem2, fix);

  insert into projects (name, company_id) values ('S P1', c) returning id into p1;
  insert into projects (name, company_id) values ('S P2', c) returning id into p2;
  insert into user_project_assignments (user_id, project_id, is_current, start_date)
  values (mem1, p1, true, '2026-01-01'), (mem2, p1, true, '2026-01-01'), (fix, p1, true, '2026-01-01'),
         (mem1, p2, true, '2026-01-01');
  insert into compensation_settings (user_id, project_id, payment_type, hourly_rate, monthly_rate, currency)
  values (mem1, p1, 'hourly', 50, null, 'EUR'), (mem2, p1, 'hourly', 70, null, 'EUR'),
         (fix, p1, 'fixed', null, 3000, 'EUR'), (mem1, p2, 'hourly', 50, null, 'EUR');
  insert into user_billing_profiles (user_id, legal_name, tax_id, billing_email, country, bank_account)
  values (mem1, 'M1 SL', 'M1-TAX', 'm1@test.invalid', 'ES', 'ES00 M1'),
         (mem2, 'M2 SL', 'M2-TAX', 'm2@test.invalid', 'ES', 'ES00 M2');

  -- ===== Admin manages supervisions (RLS) =====
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into project_supervisions (project_id, supervisor_id, member_id) values (p1, sup, mem1)
  returning company_id::text into v;
  r := r || 'admin_assign=' || (v = c::text);
  begin
    insert into project_supervisions (project_id, supervisor_id, member_id) values (p1, sup, fix);
    r := r || ' SUPERVISE_FIXED=ALLOWED!';
  exception when others then r := r || ' supervise_fixed=blocked';
  end;
  begin
    insert into project_supervisions (project_id, supervisor_id, member_id) values (p1, mem1, mem1);
    r := r || ' SELF_SUPERVISION=ALLOWED!';
  exception when others then r := r || ' self_supervision=blocked';
  end;
  execute 'reset role';

  -- ===== Supervisor cannot assign supervisions =====
  perform set_config('request.jwt.claims', json_build_object('sub', sup, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    insert into project_supervisions (project_id, supervisor_id, member_id) values (p1, sup, mem2);
    r := r || ' SUP_SELF_ASSIGN=ALLOWED!';
  exception when others then r := r || ' sup_self_assign=blocked';
  end;
  execute 'reset role';

  -- ===== Members log hours; review fields cannot be forged =====
  perform set_config('request.jwt.claims', json_build_object('sub', mem1, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into tasks (user_id, project_id, task_date, hours, name, review_status, reviewed_by)
  values (mem1, p1, '2026-03-10', 6, 'M1 task', 'approved', mem1)
  returning id, review_status into t1, v;
  r := r || ' | forged_insert_status=' || v;
  insert into tasks (user_id, project_id, task_date, hours, name)
  values (mem1, p2, '2026-03-11', 2, 'M1 task in P2 (not supervised)') returning id into t3;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', mem2, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into tasks (user_id, project_id, task_date, hours, name)
  values (mem2, p1, '2026-03-10', 3, 'M2 task') returning id into t2;
  execute 'reset role';

  select count(*) into n from notifications where user_id = sup and type = 'task_review_requested';
  r := r || ' sup_notified=' || n;

  -- ===== Supervisor: no money, only supervised tasks =====
  perform set_config('request.jwt.claims', json_build_object('sub', sup, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from tasks;                       r := r || ' | SUP direct tasks=' || n;
  select count(*) into n from compensation_settings;       r := r || ' comp=' || n;
  select count(*) into n from invoices;                    r := r || ' invoices=' || n;
  select count(*) into n from invoice_items;               r := r || ' items=' || n;
  select count(*) into n from user_billing_profiles;       r := r || ' billing=' || n;
  select count(*) into n from profiles;                    r := r || ' profiles=' || n;
  select count(*) into n from project_supervisions;        r := r || ' supervisions=' || n;
  select count(*) into n from list_review_tasks();         r := r || ' review_list=' || n;
  select count(*) into n from list_review_tasks() where id in (t2, t3); r := r || ' sees_unsupervised=' || n;
  begin
    perform review_task(t2, 'approve');
    r := r || ' SUP_APPROVED_UNSUPERVISED=ALLOWED!';
  exception when others then r := r || ' unsupervised_review=blocked';
  end;
  begin
    perform review_task(t1, 'set', 4);
    r := r || ' SUP_SET_HOURS=ALLOWED!';
  exception when others then r := r || ' sup_set=blocked';
  end;
  select review_task(t1, 'propose', 4, 'la reunión no cuenta') into v;  r := r || ' propose=' || v;
  update tasks set hours = 1 where id = t1;
  get diagnostics n = row_count;                           r := r || ' sup_direct_update=' || n;
  execute 'reset role';

  select count(*) into n from notifications where user_id = mem1 and type = 'task_reviewed';
  r := r || ' mem_notified=' || n;
  select count(*) into n from notifications
  where user_id = sup and (body ~ '50|70|3000' or metadata::text ~ 'rate|total|currency');
  r := r || ' money_in_sup_notifications=' || n;

  -- ===== Member: cannot self-approve, answers the proposal =====
  perform set_config('request.jwt.claims', json_build_object('sub', mem1, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update tasks set review_status = 'approved', proposed_hours = null where id = t1;
  select review_status into v from tasks where id = t1;    r := r || ' | forged_update_status=' || v;
  begin
    perform review_task(t1, 'approve');
    r := r || ' SELF_REVIEW=ALLOWED!';
  exception when others then r := r || ' self_review=blocked';
  end;
  select respond_to_task_proposal(t1, true, 'ok') into v;  r := r || ' accept=' || v;
  select hours into num from tasks where id = t1;          r := r || ' hours_after_accept=' || num;
  update tasks set hours = 4.5 where id = t1;
  select review_status into v from tasks where id = t1;    r := r || ' status_after_edit=' || v;
  execute 'reset role';

  select count(*) into n from notifications where user_id = sup and type = 'task_proposal_answered';
  r := r || ' reviewer_notified=' || n;

  -- ===== Admin sets hours directly =====
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from list_review_tasks(p1);       r := r || ' | ADMIN review_list_p1=' || n;
  select review_task(t1, 'set', 5) into v;                 r := r || ' admin_set=' || v;
  update projects set requires_approval = true where id = p1;
  execute 'reset role';
  select hours into num from tasks where id = t1;          r := r || ' hours=' || num;

  -- ===== Invoicing with requires_approval: blocked while a task is not approved =====
  insert into tasks (user_id, project_id, task_date, hours, name) values (mem1, p1, '2026-03-12', 3, 'M1 pending')
  returning id into t2;
  begin
    perform generate_user_invoice(mem1, '2026-03-01', '2026-03-31');
    r := r || ' | INVOICE_WITH_UNAPPROVED=ALLOWED!';
  exception when others then r := r || ' | invoice_with_unapproved=blocked(' || left(sqlerrm, 40) || ')';
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform review_task(t2, 'approve');
  execute 'reset role';
  perform generate_user_invoice(mem1, '2026-03-01', '2026-03-31');
  select string_agg(p.name || ':' || ii.quantity, ',' order by p.name) into v
  from invoice_items ii join invoices i on i.id = ii.invoice_id join projects p on p.id = ii.project_id
  where i.user_id = mem1;
  r := r || ' invoice_items=' || coalesce(v, '-');        -- expected S P1:8.00, S P2:2.00
  select count(*) into n from tasks where user_id = mem1 and invoice_id is null;
  r := r || ' unbilled_left=' || n;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', sup, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    perform review_task(t1, 'approve');
    r := r || ' REVIEW_BILLED=ALLOWED!';
  exception when others then r := r || ' review_billed=blocked';
  end;
  execute 'reset role';

  -- ===== Grants =====
  select string_agg(p.proname, ',') into v
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.proname in ('list_review_tasks', 'review_task', 'respond_to_task_proposal', 'fmt_hours')
    and has_function_privilege('anon', p.oid, 'execute');
  r := r || ' | anon_rpcs=' || coalesce(v, 'none');

  raise exception 'TEST_ROLLBACK %', r;
end;
$$;
