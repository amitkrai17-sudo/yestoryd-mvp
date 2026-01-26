
-- SQL for Supabase Postgres Trigger

-- 1. Create a function to update auth.users.user_metadata
CREATE OR REPLACE FUNCTION public.update_coach_user_metadata()
RETURNS TRIGGER AS $$
DECLARE
  new_metadata JSONB;
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    -- Get existing user_metadata or initialize it if null
    SELECT user_metadata INTO new_metadata FROM auth.users WHERE id = NEW.user_id;

    IF new_metadata IS NULL THEN
      new_metadata := '{}'::JSONB;
    END IF;

    -- Update user_metadata with coach role and active status
    new_metadata := jsonb_set(
      new_metadata,
      '{role}',
      '"coach"',
      true -- create_if_missing
    );
    new_metadata := jsonb_set(
      new_metadata,
      '{is_active_coach}',
      to_jsonb(NEW.is_active),
      true -- create_if_missing
    );

    -- Update the auth.users table
    UPDATE auth.users
    SET user_metadata = new_metadata
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create a trigger that fires after insert or update on the public.coaches table
CREATE OR REPLACE TRIGGER coaches_on_change
AFTER INSERT OR UPDATE ON public.coaches
FOR EACH ROW EXECUTE FUNCTION public.update_coach_user_metadata();

-- Optional: Initial sync for existing coaches (run once manually)
-- UPDATE auth.users
-- SET user_metadata = jsonb_set(
--   jsonb_set(
--     COALESCE(auth.users.user_metadata, '{}'::jsonb),
--     '{role}',
--     '"coach"',
--     true
--   ),
--   '{is_active_coach}',
--   to_jsonb(public.coaches.is_active),
--   true
-- )
-- FROM public.coaches
-- WHERE auth.users.id = public.coaches.user_id
-- AND COALESCE(auth.users.user_metadata->>'role', '') <> 'coach';

