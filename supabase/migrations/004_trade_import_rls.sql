-- ============================================================
-- Migration: 004_trade_import_rls
-- Description: Enable Row Level Security on trades and import_batches
-- ============================================================

-- ============================================================
-- ENABLE RLS
-- ============================================================

ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- IMPORT BATCHES POLICIES
-- ============================================================

CREATE POLICY "Users can view own import batches"
  ON import_batches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own import batches"
  ON import_batches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own import batches"
  ON import_batches FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own import batches"
  ON import_batches FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- TRADES POLICIES
-- ============================================================

CREATE POLICY "Users can view own trades"
  ON trades FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own trades"
  ON trades FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trades"
  ON trades FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own trades"
  ON trades FOR DELETE
  USING (auth.uid() = user_id);
