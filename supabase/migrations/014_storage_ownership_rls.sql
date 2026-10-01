-- ============================================================
-- Migration: 014_storage_ownership_rls
-- Description: Enforce strict trade-ownership on storage.objects for trade-screenshots.
-- Ensures that:
-- 1. Unauthenticated users cannot read/write/delete screenshots
-- 2. User A cannot upload into User B's trade paths or screenshots
-- 3. User A cannot view or delete User B's screenshots
-- 4. Storage paths are strictly checked against trades.user_id = auth.uid()
-- ============================================================

-- Ensure the bucket exists and is strictly private
INSERT INTO storage.buckets (id, name, public)
VALUES ('trade-screenshots', 'trade-screenshots', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Drop prior permissive or bucket-only policies
DROP POLICY IF EXISTS "Users can upload screenshots for own trades" ON storage.objects;
DROP POLICY IF EXISTS "Users can view screenshots of own trades" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete screenshots of own trades" ON storage.objects;
DROP POLICY IF EXISTS "Users can update screenshots of own trades" ON storage.objects;

-- Security Definer Helper: Extracts trade_id from the canonical storage path:
-- 'trades/<trade_id>/<filename>' and confirms that the trade belongs to auth.uid().
CREATE OR REPLACE FUNCTION public.check_trade_screenshot_ownership(storage_name TEXT, user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_trade_id_str TEXT;
BEGIN
  IF user_uuid IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Verify path root is 'trades'
  IF split_part(storage_name, '/', 1) <> 'trades' THEN
    RETURN FALSE;
  END IF;

  -- Extract trade_id
  v_trade_id_str := split_part(storage_name, '/', 2);
  IF v_trade_id_str IS NULL OR v_trade_id_str = '' THEN
    RETURN FALSE;
  END IF;

  -- Confirm trade exists and is owned by the user
  RETURN EXISTS (
    SELECT 1 FROM public.trades
    WHERE trades.id::text = v_trade_id_str
      AND trades.user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. INSERT RLS: Authenticated user can ONLY upload into their own trade paths
CREATE POLICY "Users can upload screenshots for own trades"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'trade-screenshots'
    AND public.check_trade_screenshot_ownership(name, auth.uid())
  );

-- 2. SELECT RLS: Authenticated user can ONLY view screenshots for their own trades
CREATE POLICY "Users can view screenshots of own trades"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'trade-screenshots'
    AND public.check_trade_screenshot_ownership(name, auth.uid())
  );

-- 3. UPDATE RLS: Authenticated user can ONLY update screenshots for their own trades
CREATE POLICY "Users can update screenshots of own trades"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'trade-screenshots'
    AND public.check_trade_screenshot_ownership(name, auth.uid())
  )
  WITH CHECK (
    bucket_id = 'trade-screenshots'
    AND public.check_trade_screenshot_ownership(name, auth.uid())
  );

-- 4. DELETE RLS: Authenticated user can ONLY delete screenshots for their own trades
CREATE POLICY "Users can delete screenshots of own trades"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'trade-screenshots'
    AND public.check_trade_screenshot_ownership(name, auth.uid())
  );
