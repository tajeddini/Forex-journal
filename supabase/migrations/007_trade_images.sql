-- ============================================================
-- Migration: 007_trade_images
-- Description: Create trade_images table for screenshot metadata
-- ============================================================

CREATE TABLE trade_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Storage metadata
  storage_provider TEXT NOT NULL DEFAULT 'supabase',
  storage_bucket TEXT NOT NULL DEFAULT 'trade-screenshots',
  storage_path TEXT NOT NULL,
  
  -- File metadata
  original_filename TEXT NOT NULL,
  original_size_bytes BIGINT NOT NULL,
  processed_size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT trade_images_storage_path_unique UNIQUE (storage_path)
);

-- Indexes
CREATE INDEX idx_trade_images_trade_id ON trade_images(trade_id);
CREATE INDEX idx_trade_images_user_id ON trade_images(user_id);
CREATE INDEX idx_trade_images_created_at ON trade_images(created_at DESC);
CREATE INDEX idx_trade_images_storage_provider ON trade_images(storage_provider);

-- Trigger for updated_at
CREATE TRIGGER update_trade_images_updated_at
  BEFORE UPDATE ON trade_images
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
