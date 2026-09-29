-- ============================================================
-- Migration: 010_trading_reviews_rls
-- Description: Enable RLS for trading_reviews table
-- ============================================================

ALTER TABLE trading_reviews ENABLE ROW LEVEL SECURITY;

-- Users can only view their own reviews
CREATE POLICY "Users can view own reviews"
  ON trading_reviews FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own reviews
CREATE POLICY "Users can insert own reviews"
  ON trading_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own reviews
CREATE POLICY "Users can update own reviews"
  ON trading_reviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own reviews
CREATE POLICY "Users can delete own reviews"
  ON trading_reviews FOR DELETE
  USING (auth.uid() = user_id);
