-- =============================================================================
-- Invoxa — API keys for agents (PRP-002, Phase 1, INV0009)
-- =============================================================================
-- Personal API keys ("ivx_..."), used by the agent-api Edge Function to act as
-- ONE collaborator (role 'user', never admin).
--   * Only the SHA-256 hash is stored; the plain key is returned once by
--     create_api_key() and never again.
--   * Clients can read their own keys (admins: their company's) but never the
--     hash column, and can only write through the RPCs below.
--   * tasks.source marks the tasks created through the API.
-- =============================================================================

-- 1. Table ---------------------------------------------------------------------
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  company_id uuid not null references companies(id) on delete restrict,
  name text not null check (char_length(name) between 2 and 80),
  key_prefix text not null,
  key_hash text not null unique,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_api_keys_user on api_keys(user_id);
create index idx_api_keys_company on api_keys(company_id);

create trigger api_keys_set_company
  before insert or update of user_id on api_keys
  for each row execute function set_company_from_user();

alter table api_keys enable row level security;

-- Reads: owner, or admin of the key's company. No write policies: writes go
-- through the security definer functions (or the service role).
create policy "api_keys_self_or_admin_read"
  on api_keys for select
  to authenticated
  using (user_id = auth.uid() or is_company_admin(company_id));

-- The hash never leaves the database through the client API.
revoke all on api_keys from anon, authenticated;
grant select (id, user_id, company_id, name, key_prefix, last_used_at, revoked_at, created_at)
  on api_keys to authenticated;

-- 2. Create a key (returns the plain key ONCE) ---------------------------------
create or replace function create_api_key(p_name text)
returns table (id uuid, name text, key_prefix text, api_key text, created_at timestamptz)
language plpgsql
volatile
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_profile profiles%rowtype;
  v_name text := btrim(coalesce(p_name, ''));
  v_secret text;
  v_key text;
  v_active int;
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;

  select * into v_profile from profiles where profiles.id = v_uid;
  if v_profile.id is null or v_profile.role <> 'user' then
    raise exception 'Solo los colaboradores pueden crear keys de API' using errcode = '42501';
  end if;
  if v_profile.status = 'inactive' then
    raise exception 'Usuario inactivo' using errcode = '42501';
  end if;
  if char_length(v_name) not between 2 and 80 then
    raise exception 'El nombre debe tener entre 2 y 80 caracteres' using errcode = '22023';
  end if;

  select count(*) into v_active from api_keys k
  where k.user_id = v_uid and k.revoked_at is null;
  if v_active >= 5 then
    raise exception 'Máximo 5 keys activas: revoca una antes de crear otra' using errcode = '54000';
  end if;

  -- 32 random bytes, base64url without padding.
  v_secret := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  v_key := 'ivx_' || v_secret;

  return query
  insert into api_keys as k (user_id, company_id, name, key_prefix, key_hash)
  values (
    v_uid,
    v_profile.company_id,
    v_name,
    left(v_secret, 8),
    encode(sha256(convert_to(v_key, 'UTF8')), 'hex')
  )
  returning k.id, k.name, k.key_prefix, v_key, k.created_at;
end;
$$;

-- 3. Revoke a key (owner, or admin of its company) -----------------------------
create or replace function revoke_api_key(p_key_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_key api_keys%rowtype;
begin
  if auth.uid() is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;

  select * into v_key from api_keys where id = p_key_id;
  if v_key.id is null
     or not (v_key.user_id = auth.uid() or is_company_admin(v_key.company_id)) then
    raise exception 'Key no encontrada' using errcode = 'P0002';
  end if;

  update api_keys set revoked_at = coalesce(revoked_at, now()) where id = p_key_id;
end;
$$;

revoke all on function create_api_key(text) from public, anon;
revoke all on function revoke_api_key(uuid) from public, anon;
grant execute on function create_api_key(text) to authenticated;
grant execute on function revoke_api_key(uuid) to authenticated;

-- 4. Mark tasks created through the API -----------------------------------------
alter table tasks
  add column source text not null default 'app'
  check (source in ('app', 'api'));
