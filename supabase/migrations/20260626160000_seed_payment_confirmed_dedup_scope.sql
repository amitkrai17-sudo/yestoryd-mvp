-- ============================================================================
-- seed_payment_confirmed_dedup_scope
-- ============================================================================
-- REPO-PARITY ONLY. Web applies this seed via Supabase MCP **AFTER** the Phase 2C
-- deploy is READY (activation is the reversible final step). DO NOT run it before
-- the 2C code is live — and the 2C code is INERT until this row is set:
--   dedup_scope NULL  → sendCommunication engage gate = false → legacy 2-row path.
--   un-seeding (set back to NULL) = instant rollback of the payment dedup.
--
-- Engages the opt-in atomic claim in lib/communication/sendCommunication for
-- parent_payment_confirmed_v3, keyed on meta.paymentId (razorpay_payment_id at
-- verify+webhook → one key per payment; internal payments.id offline). A renewal
-- carries a new pay_… → different key → NOT suppressed.
-- ============================================================================

UPDATE communication_templates
  SET dedup_scope = '{"fields":["paymentId"]}'::jsonb
  WHERE template_code = 'parent_payment_confirmed_v3';

-- ----------------------------------------------------------------------------
-- ROLLBACK (instant — re-inert the 2C path)
-- ----------------------------------------------------------------------------
-- UPDATE communication_templates SET dedup_scope = NULL WHERE template_code = 'parent_payment_confirmed_v3';
