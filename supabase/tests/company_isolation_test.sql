-- Run against the linked project: supabase db query --linked -f supabase/tests/company_isolation_test.sql
-- Expected output: one "TEST_ROLLBACK ..." error line with all checks (see PRP-001).
-- The ids of a_admin / a_user are real Informage profiles; adjust if they change.
-- Isolation test for PRP-001 Phase 2. Everything is rolled back by the final
-- RAISE EXCEPTION: no data persists.
do $$
declare
  a_company uuid := '5b1c2e0a-7d43-4f8e-9a61-3c0f5e2d9b17';
  a_admin uuid := '56ab4c15-a8cf-4945-b8c1-e03d6b039ab5';
  a_user uuid := 'e0b535ee-d812-4b92-ab37-014169f71487';
  b_company uuid := gen_random_uuid();
  b_admin uuid := gen_random_uuid();
  b_user uuid := gen_random_uuid();
  s_admin uuid := gen_random_uuid();
  b_project uuid;
  n int;
  r text := '';
  v text;
begin
  insert into companies (id, name, legal_name, tax_id, country, invoice_prefix)
  values (b_company, 'TestB', 'TestB SL', 'X1', 'ES', 'TSTB');

  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
  values
    (b_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b-admin@test.invalid',
     jsonb_build_object('role', 'admin', 'company_id', b_company, 'user_code', 'BADM'), now(), now(), now()),
    (b_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b-user@test.invalid',
     jsonb_build_object('role', 'user', 'company_id', b_company, 'user_code', 'BUSR'), now(), now(), now()),
    (s_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's-admin@test.invalid',
     jsonb_build_object('role', 'user', 'company_id', b_company), now(), now(), now());

  update profiles set role = 'super_admin', company_id = null, active_company_id = a_company where id = s_admin;

  insert into projects (name, company_id) values ('TestB project', b_company) returning id into b_project;
  insert into tasks (user_id, project_id, task_date, hours, name) values (b_user, b_project, current_date, 2, 'B task');

  select company_id::text into v from profiles where id = b_admin;
  r := r || ' | b_admin_company_ok=' || (v = b_company::text);

  -- ===== As Informage admin =====
  perform set_config('request.jwt.claims', json_build_object('sub', a_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from tasks where company_id = b_company;   r := r || ' | A_admin sees B tasks=' || n;
  select count(*) into n from tasks;                                r := r || ' A tasks=' || n;
  select count(*) into n from profiles;                             r := r || ' profiles=' || n;
  select count(*) into n from projects;                             r := r || ' projects=' || n;
  select count(*) into n from companies;                            r := r || ' companies=' || n;
  update tasks set hours = 99 where company_id = b_company;
  get diagnostics n = row_count;                                    r := r || ' upd_B_tasks=' || n;
  begin
    update profiles set role = 'super_admin', company_id = null where id = a_admin;
    r := r || ' SELF_PROMOTE=ALLOWED!';
  exception when others then r := r || ' self_promote=blocked';
  end;
  begin
    update profiles set company_id = b_company where id = a_user;
    get diagnostics n = row_count;
    r := r || ' MOVE_USER_TO_B=' || n || '!';
  exception when others then r := r || ' move_user=blocked';
  end;
  execute 'reset role';

  -- ===== As company B admin =====
  perform set_config('request.jwt.claims', json_build_object('sub', b_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from tasks;                                r := r || ' | B_admin tasks=' || n;
  select count(*) into n from invoices;                             r := r || ' invoices=' || n;
  select count(*) into n from invoice_items;                        r := r || ' items=' || n;
  select count(*) into n from profiles;                             r := r || ' profiles=' || n;
  select count(*) into n from projects;                             r := r || ' projects=' || n;
  select count(*) into n from compensation_settings;                r := r || ' comp=' || n;
  select count(*) into n from notifications;                        r := r || ' notif=' || n;
  select count(*) into n from storage.objects;                      r := r || ' files=' || n;
  select string_agg(name, ',') into v from companies;               r := r || ' companies=' || coalesce(v, '-');
  update invoices set notes = 'hack' where company_id = a_company;
  get diagnostics n = row_count;                                    r := r || ' upd_A_invoices=' || n;
  delete from tasks where company_id = a_company;
  get diagnostics n = row_count;                                    r := r || ' del_A_tasks=' || n;
  begin
    insert into projects (name, company_id) values ('spoof', a_company);
    r := r || ' SPOOF_PROJECT=ALLOWED!';
  exception when others then r := r || ' spoof_project=blocked';
  end;
  insert into projects (name) values ('B own') returning company_id::text into v;
  r := r || ' own_project_in_B=' || (v = b_company::text);
  execute 'reset role';

  -- ===== As company B collaborator =====
  perform set_config('request.jwt.claims', json_build_object('sub', b_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from tasks;                                r := r || ' | B_user tasks=' || n;
  select count(*) into n from projects;                             r := r || ' projects=' || n;
  select count(*) into n from profiles;                             r := r || ' profiles=' || n;
  execute 'reset role';

  -- ===== As Informage collaborator =====
  perform set_config('request.jwt.claims', json_build_object('sub', a_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from tasks;                                r := r || ' | A_user tasks=' || n;
  select count(*) into n from projects;                             r := r || ' projects=' || n;
  select count(*) into n from storage.objects;                      r := r || ' files=' || n;
  execute 'reset role';

  -- ===== As super admin, operating in Informage, then in B =====
  perform set_config('request.jwt.claims', json_build_object('sub', s_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from tasks;                                r := r || ' | SA@A tasks=' || n;
  select count(*) into n from storage.objects;                      r := r || ' files=' || n;
  select count(*) into n from companies;                            r := r || ' companies=' || n;
  update profiles set active_company_id = b_company where id = s_admin;
  select count(*) into n from tasks;                                r := r || ' | SA@B tasks=' || n;
  select count(*) into n from profiles where company_id = a_company; r := r || ' A_profiles=' || n;
  execute 'reset role';

  -- ===== Numbering uses the company prefix =====
  select invoice_number into v from next_invoice_number(b_user, 2026);
  r := r || ' | B number=' || v;
  select invoice_number into v from next_invoice_number(a_user, 2026);
  r := r || ' A number=' || v;

  -- ===== API keys (PRP-002) =====
  declare
    b_key_id uuid;
    b_key text;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', b_user, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select k.id, k.api_key into b_key_id, b_key from create_api_key('B agent') k;
    r := r || ' | B key=' || (b_key like 'ivx_%') || ' len=' || length(b_key);
    select count(*) into n from api_keys;                           r := r || ' B_user keys=' || n;
    begin
      perform key_hash from api_keys;
      r := r || ' HASH_READABLE!';
    exception when others then r := r || ' hash=hidden';
    end;
    begin
      insert into api_keys (user_id, company_id, name, key_prefix, key_hash)
      values (b_user, b_company, 'direct', 'x', 'x');
      r := r || ' DIRECT_INSERT=ALLOWED!';
    exception when others then r := r || ' direct_insert=blocked';
    end;
    execute 'reset role';

    perform set_config('request.jwt.claims', json_build_object('sub', a_user, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into n from api_keys where user_id = b_user;    r := r || ' A_user sees B keys=' || n;
    begin
      perform revoke_api_key(b_key_id);
      r := r || ' A_USER_REVOKED_B!';
    exception when others then r := r || ' A_user_revoke=blocked';
    end;
    execute 'reset role';

    perform set_config('request.jwt.claims', json_build_object('sub', a_admin, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into n from api_keys where user_id = b_user;    r := r || ' A_admin sees B keys=' || n;
    begin
      perform create_api_key('admin key');
      r := r || ' ADMIN_KEY=ALLOWED!';
    exception when others then r := r || ' admin_key=blocked';
    end;
    execute 'reset role';

    perform set_config('request.jwt.claims', json_build_object('sub', b_admin, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into n from api_keys;                           r := r || ' B_admin keys=' || n;
    perform revoke_api_key(b_key_id);
    execute 'reset role';
    select count(*) into n from api_keys where id = b_key_id and revoked_at is not null;
    r := r || ' B_admin_revoked=' || n;
    select count(*) into n from api_keys
    where id = b_key_id and key_hash = encode(sha256(convert_to(b_key, 'UTF8')), 'hex');
    r := r || ' hash_matches=' || n;
  end;

  raise exception 'TEST_ROLLBACK%', r;
end;
$$;
