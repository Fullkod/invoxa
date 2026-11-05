-- =============================================================================
-- Invoxa — Lock down privileged SQL functions (isolation audit, 2026-11-05)
-- =============================================================================
-- Postgres grants EXECUTE on new functions to PUBLIC, and Supabase also grants
-- it to anon/authenticated. These SECURITY DEFINER functions bypass RLS and do
-- not check who calls them, so anyone holding the public anon key could call
-- them through /rest/v1/rpc/ for users and invoices of ANY company:
--   * generate_user_invoice   → create an invoice for any user
--   * apply_invoice_number_change → rename any invoice (and spoof changed_by)
--   * next_invoice_number     → read any user's code / invoice count
--   * notify_user             → send any user a notification with free text
-- Only the Edge Functions (service role) and SECURITY DEFINER triggers (run as
-- the owner) call them, so EXECUTE goes to service_role only.
--
-- Not touched on purpose:
--   * is_company_admin / is_admin / is_super_admin / current_company_id: used
--     inside RLS policies, which run as the caller; revoking breaks every query.
--   * create_api_key / revoke_api_key: already restricted (20261104000006).
--   * Trigger functions: PostgREST cannot call them, and triggers do not need
--     the caller to hold EXECUTE.
-- Rule from now on: every new function in public declares its grants.
-- =============================================================================

revoke all on function generate_user_invoice(uuid, date, date) from public, anon, authenticated;
revoke all on function apply_invoice_number_change(uuid, text, uuid, uuid, text) from public, anon, authenticated;
revoke all on function next_invoice_number(uuid, integer) from public, anon, authenticated;
revoke all on function notify_user(uuid, notification_type, text, text, text, uuid, jsonb) from public, anon, authenticated;

grant execute on function generate_user_invoice(uuid, date, date) to service_role;
grant execute on function apply_invoice_number_change(uuid, text, uuid, uuid, text) to service_role;
grant execute on function next_invoice_number(uuid, integer) to service_role;
grant execute on function notify_user(uuid, notification_type, text, text, text, uuid, jsonb) to service_role;
