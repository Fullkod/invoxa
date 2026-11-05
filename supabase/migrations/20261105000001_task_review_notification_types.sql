-- =============================================================================
-- Invoxa — Notification types for task review (PRP-003, Phase 1)
-- =============================================================================
-- Separate file: a new enum value cannot be used in the transaction that adds it.
--   task_review_requested  → supervisor: a supervised member logged hours
--   task_reviewed          → member: their task was approved / changes proposed
--   task_proposal_answered → reviewer: the member accepted or rejected a proposal
-- =============================================================================

alter type notification_type add value if not exists 'task_review_requested';
alter type notification_type add value if not exists 'task_reviewed';
alter type notification_type add value if not exists 'task_proposal_answered';
