-- =============================================================================
-- Invoxa — super_admin role (PRP-001, Phase 1, INV0003)
-- =============================================================================
-- Own migration: a new enum value cannot be used in the transaction that adds
-- it. Nobody gets this role yet; the frontend handles it from Phase 4.
-- =============================================================================

alter type user_role add value if not exists 'super_admin';
