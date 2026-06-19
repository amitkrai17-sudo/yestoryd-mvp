-- ALREADY APPLIED to prod via MCP on 2026-06-19; file for repo parity. DO NOT re-run.
-- Canonical guard: fixed function (array_append + visible WARNING) + the trigger.
CREATE OR REPLACE FUNCTION public.scheduled_sessions_ssot_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changed text[] := ARRAY[]::text[];
BEGIN
  BEGIN
    -- MUTATE detection. Use array_append (|| with text was misparsing as array-concat).
    IF NEW.status IS DISTINCT FROM OLD.status THEN v_changed := array_append(v_changed, 'status'); END IF;
    IF NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN v_changed := array_append(v_changed, 'completed_at'); END IF;
    IF NEW.disposition IS DISTINCT FROM OLD.disposition THEN v_changed := array_append(v_changed, 'disposition'); END IF;
    IF NEW.session_mode IS DISTINCT FROM OLD.session_mode THEN v_changed := array_append(v_changed, 'session_mode'); END IF;
    IF NEW.offline_request_status IS DISTINCT FROM OLD.offline_request_status THEN v_changed := array_append(v_changed, 'offline_request_status'); END IF;
    IF NEW.offline_approved_by IS DISTINCT FROM OLD.offline_approved_by THEN v_changed := array_append(v_changed, 'offline_approved_by'); END IF;
    IF NEW.offline_approved_at IS DISTINCT FROM OLD.offline_approved_at THEN v_changed := array_append(v_changed, 'offline_approved_at'); END IF;
    IF NEW.google_event_id IS DISTINCT FROM OLD.google_event_id THEN v_changed := array_append(v_changed, 'google_event_id'); END IF;
    IF NEW.google_meet_link IS DISTINCT FROM OLD.google_meet_link THEN v_changed := array_append(v_changed, 'google_meet_link'); END IF;
    IF NEW.scheduled_date IS DISTINCT FROM OLD.scheduled_date THEN v_changed := array_append(v_changed, 'scheduled_date'); END IF;
    IF NEW.scheduled_time IS DISTINCT FROM OLD.scheduled_time THEN v_changed := array_append(v_changed, 'scheduled_time'); END IF;

    IF array_length(v_changed, 1) IS NULL THEN
      RETURN NEW;
    END IF;

    IF 'status' = ANY(v_changed) OR 'completed_at' = ANY(v_changed) OR 'disposition' = ANY(v_changed) THEN
      INSERT INTO public.ssot_violations(table_name, session_id, band, changed_cols, col, old_value, new_value, db_user, txid)
      VALUES ('scheduled_sessions', NEW.id, 'status', v_changed, 'status', OLD.status, NEW.status, current_user, txid_current());
    END IF;
    IF 'session_mode' = ANY(v_changed) OR 'offline_request_status' = ANY(v_changed)
       OR 'offline_approved_by' = ANY(v_changed) OR 'offline_approved_at' = ANY(v_changed) THEN
      INSERT INTO public.ssot_violations(table_name, session_id, band, changed_cols, col, old_value, new_value, db_user, txid)
      VALUES ('scheduled_sessions', NEW.id, 'mode', v_changed, 'session_mode', OLD.session_mode, NEW.session_mode, current_user, txid_current());
    END IF;
    IF 'google_event_id' = ANY(v_changed) OR 'google_meet_link' = ANY(v_changed) THEN
      INSERT INTO public.ssot_violations(table_name, session_id, band, changed_cols, col, old_value, new_value, db_user, txid)
      VALUES ('scheduled_sessions', NEW.id, 'calendar', v_changed, 'google_event_id', OLD.google_event_id, NEW.google_event_id, current_user, txid_current());
    END IF;
    IF 'scheduled_date' = ANY(v_changed) OR 'scheduled_time' = ANY(v_changed) THEN
      INSERT INTO public.ssot_violations(table_name, session_id, band, changed_cols, col, old_value, new_value, db_user, txid)
      VALUES ('scheduled_sessions', NEW.id, 'date', v_changed, 'scheduled_date', OLD.scheduled_date::text, NEW.scheduled_date::text, current_user, txid_current());
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- Never break the parent write, but DO NOT be blind: surface the failure as a WARNING (-> logs/Sentry).
    RAISE WARNING 'ssot_guard error on session % : % (%)', NEW.id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_scheduled_sessions_ssot_guard
  AFTER UPDATE ON public.scheduled_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.scheduled_sessions_ssot_guard();
