-- =============================================================================
-- get_admin_tuition_enrichments — read-only enrichment for the admin English
-- Classes list (app/api/admin/tuition/route.ts). UI-1.1b.
--
-- Replaces the JS candidate-phone pre-filter, which MISSED malformed stored
-- formats like recipient_phone='91+919920828303' (the .in() candidate set
-- {k,91k,+91k,0k} never produced that string, so the row was dropped before JS
-- normalization could match it). Here normalization + match happen in ONE place
-- (SQL): right(regexp_replace(phone,'\D','','g'), 10) on BOTH sides.
--
-- Returns a UNION of two row kinds (caller demuxes):
--   * lifetime rows  → enrollment_id + lifetime_credited (wa cols NULL)
--   * last_wa rows   → match_last10 + template_code/sent_at/wa_sent/error_message/channel
--
-- last_wa contract (must match lib/tuition/admin-list-enrichment.ts, which the unit
-- tests pin): most-recent send per phone, twin-collapsed by (template_code, 10s
-- window) with BOOL_OR(wa_sent). Ordering on created_at (sent_at is NULL on failed
-- sends). idempotency_key is NOT used (NULL on failures → cannot merge a {false,true}
-- twin). Email-channel rows excluded.
--
-- STABLE, SECURITY INVOKER (admin service-role route calls it), no writes.
-- Idempotent (CREATE OR REPLACE). DDL applied to prod via MCP; this file is the record.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_admin_tuition_enrichments(
  p_enrollment_ids uuid[],
  p_phones text[]
)
RETURNS TABLE (
  enrollment_id    uuid,
  lifetime_credited int,
  match_last10     text,
  template_code    text,
  sent_at          timestamptz,
  wa_sent          boolean,
  error_message    text,
  channel          text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH lifetime AS (
    -- SUM(change_amount) FILTER (WHERE change_amount > 0) per enrollment
    SELECT l.enrollment_id,
           COALESCE(SUM(l.change_amount) FILTER (WHERE l.change_amount > 0), 0)::int AS lifetime_credited
    FROM tuition_session_ledger l
    WHERE l.enrollment_id = ANY(p_enrollment_ids)
    GROUP BY l.enrollment_id
  ),
  phones AS (
    SELECT DISTINCT right(regexp_replace(p, '\D', '', 'g'), 10) AS last10
    FROM unnest(p_phones) AS p
    WHERE length(regexp_replace(p, '\D', '', 'g')) >= 10
  ),
  wa AS (
    -- WhatsApp send rows for the requested phones (normalized both sides).
    -- wa_sent IS NOT NULL is the WA discriminant: a WA attempt sets wa_sent true
    -- (sent) or false (failed twin); email-only rows leave wa_sent NULL. The prod
    -- channel taxonomy is {null, aisensy, leadbot} with email sends sitting in
    -- channel=NULL mixed with WA rows, so channel CANNOT isolate email here.
    SELECT
      right(regexp_replace(cl.recipient_phone, '\D', '', 'g'), 10) AS last10,
      cl.template_code,
      cl.wa_sent,
      cl.error_message,
      cl.channel,
      cl.sent_at,
      cl.created_at
    FROM communication_logs cl
    WHERE cl.wa_sent IS NOT NULL
      AND cl.recipient_phone IS NOT NULL
      AND right(regexp_replace(cl.recipient_phone, '\D', '', 'g'), 10)
          IN (SELECT last10 FROM phones)
  ),
  anchored AS (
    -- newest row per phone defines the anchor template + time
    SELECT w.*,
           first_value(w.created_at)    OVER (PARTITION BY w.last10 ORDER BY w.created_at DESC) AS anchor_created_at,
           first_value(w.template_code) OVER (PARTITION BY w.last10 ORDER BY w.created_at DESC) AS anchor_template
    FROM wa w
  ),
  grp AS (
    -- collapse twins: same template within 10s of the anchor → exactly one group per phone
    SELECT
      a.last10,
      a.anchor_template AS template_code,
      bool_or(a.wa_sent) AS wa_sent,
      max(a.sent_at) FILTER (WHERE a.sent_at IS NOT NULL) AS sent_at,
      (array_agg(a.channel ORDER BY a.created_at DESC) FILTER (WHERE a.channel IS NOT NULL))[1] AS channel,
      (array_agg(a.error_message ORDER BY a.created_at DESC) FILTER (WHERE a.error_message IS NOT NULL))[1] AS newest_error
    FROM anchored a
    WHERE a.template_code = a.anchor_template
      AND a.anchor_created_at - a.created_at <= interval '10 seconds'
    GROUP BY a.last10, a.anchor_template
  )
  -- (1) lifetime rows
  SELECT l.enrollment_id, l.lifetime_credited,
         NULL::text, NULL::text, NULL::timestamptz, NULL::boolean, NULL::text, NULL::text
  FROM lifetime l
  UNION ALL
  -- (2) last_wa rows
  SELECT NULL::uuid, NULL::int,
         g.last10, g.template_code, g.sent_at, g.wa_sent,
         CASE WHEN g.wa_sent THEN NULL ELSE g.newest_error END,
         g.channel
  FROM grp g;
$$;
