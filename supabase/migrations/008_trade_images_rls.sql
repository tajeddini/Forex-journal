-- ============================================================
-- Migration: 008_trade_images_rls
-- Description: Enable Row Level Security on trade_images
-- ============================================================

ALTER TABLE trade_images ENABLE ROW LEVEL SECURITY;

-- Users can view their own trade images
CREATE POLICY "Users can view own trade images"
  ON trade_images FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own trade images
CREATE POLICY "Users can insert own trade images"
  ON trade_images FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own trade images
CREATE POLICY "Users can update own trade images"
  ON trade_images FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own trade images
CREATE POLICY "Users can delete own trade images"
  ON trade_images FOR DELETE
  USING (auth.uid() = user_id);
