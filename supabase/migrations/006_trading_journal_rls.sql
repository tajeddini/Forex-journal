-- ============================================================
-- Migration: 006_trading_journal_rls
-- Description: Enable Row Level Security on trading journal tables
-- ============================================================

-- ============================================================
-- ENABLE RLS
-- ============================================================

ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE setups ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE mistakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_mistakes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STRATEGIES POLICIES
-- ============================================================

CREATE POLICY "Users can view own strategies"
  ON strategies FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own strategies"
  ON strategies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own strategies"
  ON strategies FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own strategies"
  ON strategies FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- SETUPS POLICIES
-- ============================================================

CREATE POLICY "Users can view own setups"
  ON setups FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own setups"
  ON setups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own setups"
  ON setups FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own setups"
  ON setups FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- TAGS POLICIES
-- ============================================================

CREATE POLICY "Users can view own tags"
  ON tags FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tags"
  ON tags FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tags"
  ON tags FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tags"
  ON tags FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- MISTAKES POLICIES
-- ============================================================

CREATE POLICY "Users can view own mistakes"
  ON mistakes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own mistakes"
  ON mistakes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mistakes"
  ON mistakes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own mistakes"
  ON mistakes FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- TRADE JOURNALS POLICIES
-- ============================================================

CREATE POLICY "Users can view own trade journals"
  ON trade_journals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own trade journals"
  ON trade_journals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trade journals"
  ON trade_journals FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own trade journals"
  ON trade_journals FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- TRADE TAGS POLICIES
-- Access through trade ownership
-- ============================================================

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

-- ============================================================
-- TRADE MISTAKES POLICIES
-- Access through trade ownership
-- ============================================================

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
