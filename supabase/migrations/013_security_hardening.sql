-- ============================================================
-- Migration: 013_security_hardening
-- Description: Enforce strict relational ownership invariants,
-- multi-table cross-user reference prevention, and private storage RLS.
-- ============================================================

-- ============================================================
-- 1. CONSISTENCY & OWNERSHIP TRIGGERS
-- ============================================================

-- Validate Trade consistency
CREATE OR REPLACE FUNCTION validate_trade_ownership()
RETURNS TRIGGER AS $$
DECLARE
  v_account_user UUID;
  v_phase_account UUID;
  v_batch_user UUID;
BEGIN
  -- Verify Account belongs to trade user
  SELECT user_id INTO v_account_user FROM trading_accounts WHERE id = NEW.account_id;
  IF v_account_user IS NULL OR v_account_user <> NEW.user_id THEN
    RAISE EXCEPTION 'Cross-user integrity violation: trade user_id does not match account user_id';
  END IF;

  -- Verify Phase belongs to the same Account
  IF NEW.phase_id IS NOT NULL THEN
    SELECT account_id INTO v_phase_account FROM account_phases WHERE id = NEW.phase_id;
    IF v_phase_account IS NULL OR v_phase_account <> NEW.account_id THEN
      RAISE EXCEPTION 'Cross-entity integrity violation: phase_id does not belong to trade account_id';
    END IF;
  END IF;

  -- Verify Import Batch belongs to trade user
  IF NEW.import_batch_id IS NOT NULL THEN
    SELECT user_id INTO v_batch_user FROM import_batches WHERE id = NEW.import_batch_id;
    IF v_batch_user IS NULL OR v_batch_user <> NEW.user_id THEN
      RAISE EXCEPTION 'Cross-user integrity violation: import_batch does not belong to trade user_id';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_trade_ownership ON trades;
CREATE TRIGGER trg_validate_trade_ownership
  BEFORE INSERT OR UPDATE ON trades
  FOR EACH ROW
  EXECUTE FUNCTION validate_trade_ownership();


-- Validate Import Batch consistency
CREATE OR REPLACE FUNCTION validate_import_batch_ownership()
RETURNS TRIGGER AS $$
DECLARE
  v_account_user UUID;
  v_phase_account UUID;
BEGIN
  SELECT user_id INTO v_account_user FROM trading_accounts WHERE id = NEW.account_id;
  IF v_account_user IS NULL OR v_account_user <> NEW.user_id THEN
    RAISE EXCEPTION 'Cross-user integrity violation: batch user_id does not match account user_id';
  END IF;

  IF NEW.phase_id IS NOT NULL THEN
    SELECT account_id INTO v_phase_account FROM account_phases WHERE id = NEW.phase_id;
    IF v_phase_account IS NULL OR v_phase_account <> NEW.account_id THEN
      RAISE EXCEPTION 'Cross-entity integrity violation: phase_id does not belong to batch account_id';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_import_batch_ownership ON import_batches;
CREATE TRIGGER trg_validate_import_batch_ownership
  BEFORE INSERT OR UPDATE ON import_batches
  FOR EACH ROW
  EXECUTE FUNCTION validate_import_batch_ownership();


-- Validate Setup consistency
CREATE OR REPLACE FUNCTION validate_setup_ownership()
RETURNS TRIGGER AS $$
DECLARE
  v_strat_user UUID;
BEGIN
  IF NEW.strategy_id IS NOT NULL THEN
    SELECT user_id INTO v_strat_user FROM strategies WHERE id = NEW.strategy_id;
    IF v_strat_user IS NULL OR v_strat_user <> NEW.user_id THEN
      RAISE EXCEPTION 'Cross-user integrity violation: setup cannot reference another user strategy';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_setup_ownership ON setups;
CREATE TRIGGER trg_validate_setup_ownership
  BEFORE INSERT OR UPDATE ON setups
  FOR EACH ROW
  EXECUTE FUNCTION validate_setup_ownership();


-- Validate Trade Journal consistency
CREATE OR REPLACE FUNCTION validate_journal_ownership()
RETURNS TRIGGER AS $$
DECLARE
  v_trade_user UUID;
  v_strat_user UUID;
  v_setup_user UUID;
BEGIN
  SELECT user_id INTO v_trade_user FROM trades WHERE id = NEW.trade_id;
  IF v_trade_user IS NULL OR v_trade_user <> NEW.user_id THEN
    RAISE EXCEPTION 'Cross-user integrity violation: trade does not belong to journal user';
  END IF;

  IF NEW.strategy_id IS NOT NULL THEN
    SELECT user_id INTO v_strat_user FROM strategies WHERE id = NEW.strategy_id;
    IF v_strat_user IS NULL OR v_strat_user <> NEW.user_id THEN
      RAISE EXCEPTION 'Cross-user integrity violation: strategy does not belong to journal user';
    END IF;
  END IF;

  IF NEW.setup_id IS NOT NULL THEN
    SELECT user_id INTO v_setup_user FROM setups WHERE id = NEW.setup_id;
    IF v_setup_user IS NULL OR v_setup_user <> NEW.user_id THEN
      RAISE EXCEPTION 'Cross-user integrity violation: setup does not belong to journal user';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_journal_ownership ON trade_journals;
CREATE TRIGGER trg_validate_journal_ownership
  BEFORE INSERT OR UPDATE ON trade_journals
  FOR EACH ROW
  EXECUTE FUNCTION validate_journal_ownership();


-- Validate Trade Tag relationship consistency
CREATE OR REPLACE FUNCTION validate_trade_tag_ownership()
RETURNS TRIGGER AS $$
DECLARE
  v_trade_user UUID;
  v_tag_user UUID;
BEGIN
  SELECT user_id INTO v_trade_user FROM trades WHERE id = NEW.trade_id;
  SELECT user_id INTO v_tag_user FROM tags WHERE id = NEW.tag_id;

  IF v_trade_user IS NULL OR v_tag_user IS NULL OR v_trade_user <> v_tag_user THEN
    RAISE EXCEPTION 'Cross-user integrity violation: trade and tag must belong to the same user';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_trade_tag_ownership ON trade_tags;
CREATE TRIGGER trg_validate_trade_tag_ownership
  BEFORE INSERT ON trade_tags
  FOR EACH ROW
  EXECUTE FUNCTION validate_trade_tag_ownership();


-- Validate Trade Mistake relationship consistency
CREATE OR REPLACE FUNCTION validate_trade_mistake_ownership()
RETURNS TRIGGER AS $$
DECLARE
  v_trade_user UUID;
  v_mistake_user UUID;
BEGIN
  SELECT user_id INTO v_trade_user FROM trades WHERE id = NEW.trade_id;
  SELECT user_id INTO v_mistake_user FROM mistakes WHERE id = NEW.mistake_id;

  IF v_trade_user IS NULL OR v_mistake_user IS NULL OR v_trade_user <> v_mistake_user THEN
    RAISE EXCEPTION 'Cross-user integrity violation: trade and mistake must belong to the same user';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_trade_mistake_ownership ON trade_mistakes;
CREATE TRIGGER trg_validate_trade_mistake_ownership
  BEFORE INSERT ON trade_mistakes
  FOR EACH ROW
  EXECUTE FUNCTION validate_trade_mistake_ownership();


-- ============================================================
-- 2. HARDENED RLS POLICIES FOR JUNCTION TABLES
-- ============================================================

-- TRADE TAGS: Must check BOTH trade ownership AND tag ownership
DROP POLICY IF EXISTS "Users can view trade tags for own trades" ON trade_tags;
DROP POLICY IF EXISTS "Users can create trade tags for own trades" ON trade_tags;
DROP POLICY IF EXISTS "Users can delete trade tags for own trades" ON trade_tags;

CREATE POLICY "Users can view trade tags for own trades"
  ON trade_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = trade_tags.trade_id
      AND trades.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create trade tags for own trades"
  ON trade_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = trade_tags.trade_id
      AND trades.user_id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM tags
      WHERE tags.id = trade_tags.tag_id
      AND tags.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete trade tags for own trades"
  ON trade_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = trade_tags.trade_id
      AND trades.user_id = auth.uid()
    )
  );


-- TRADE MISTAKES: Must check BOTH trade ownership AND mistake ownership
DROP POLICY IF EXISTS "Users can view trade mistakes for own trades" ON trade_mistakes;
DROP POLICY IF EXISTS "Users can create trade mistakes for own trades" ON trade_mistakes;
DROP POLICY IF EXISTS "Users can delete trade mistakes for own trades" ON trade_mistakes;

CREATE POLICY "Users can view trade mistakes for own trades"
  ON trade_mistakes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = trade_mistakes.trade_id
      AND trades.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create trade mistakes for own trades"
  ON trade_mistakes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = trade_mistakes.trade_id
      AND trades.user_id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM mistakes
      WHERE mistakes.id = trade_mistakes.mistake_id
      AND mistakes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete trade mistakes for own trades"
  ON trade_mistakes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = trade_mistakes.trade_id
      AND trades.user_id = auth.uid()
    )
  );


-- ============================================================
-- 3. SUPABASE STORAGE RLS POLICIES FOR trade-screenshots
-- ============================================================

-- Ensure bucket exists and is private
INSERT INTO storage.buckets (id, name, public)
VALUES ('trade-screenshots', 'trade-screenshots', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Allow authenticated users to view only screenshots of their own trades
CREATE POLICY "Users can view screenshots of own trades"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'trade-screenshots'
    AND EXISTS (
      SELECT 1 FROM trade_images
      WHERE trade_images.storage_path = name
      AND trade_images.user_id = auth.uid()
    )
  );

-- Allow authenticated users to upload screenshots only for their own trades
CREATE POLICY "Users can upload screenshots for own trades"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'trade-screenshots'
  );

-- Allow authenticated users to delete screenshots of their own trades
CREATE POLICY "Users can delete screenshots of own trades"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'trade-screenshots'
    AND EXISTS (
      SELECT 1 FROM trade_images
      WHERE trade_images.storage_path = name
      AND trade_images.user_id = auth.uid()
    )
  );
