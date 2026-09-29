-- ============================================================
-- Migration: 009_trading_reviews
-- Description: Create trading_reviews table for daily/weekly/monthly reviews
-- ============================================================

CREATE TYPE review_type AS ENUM ('daily', 'weekly', 'monthly');

CREATE TABLE trading_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  review_type review_type NOT NULL,
  review_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  account_id UUID REFERENCES trading_accounts(id) ON DELETE SET NULL,
  phase_id UUID REFERENCES account_phases(id) ON DELETE SET NULL,
  
  -- Auto-calculated statistics (stored for performance)
  total_trades INTEGER DEFAULT 0,
  net_pnl NUMERIC(15, 2) DEFAULT 0,
  win_rate NUMERIC(5, 2),
  profit_factor NUMERIC(10, 2),
  expectancy NUMERIC(15, 2),
  max_drawdown NUMERIC(15, 2),
  avg_duration INTEGER,
  
  -- Review content
  summary TEXT,
  what_went_well TEXT,
  what_went_wrong TEXT,
  main_lesson TEXT,
  main_mistake TEXT,
  psychology_notes TEXT,
  rule_adherence_notes TEXT,
  improvement_plan TEXT,
  next_period_plan TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_trading_reviews_user_id ON trading_reviews(user_id);
CREATE INDEX idx_trading_reviews_review_type ON trading_reviews(review_type);
CREATE INDEX idx_trading_reviews_review_date ON trading_reviews(review_date DESC);
CREATE INDEX idx_trading_reviews_account_id ON trading_reviews(account_id);
CREATE INDEX idx_trading_reviews_period ON trading_reviews(period_start, period_end);

-- Trigger for updated_at
CREATE TRIGGER update_trading_reviews_updated_at
  BEFORE UPDATE ON trading_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
