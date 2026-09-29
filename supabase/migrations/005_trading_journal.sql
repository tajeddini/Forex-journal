-- ============================================================
-- Migration: 005_trading_journal
-- Description: Create tables for trading journal, strategies, setups, tags, mistakes
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE rule_adherence AS ENUM ('followed', 'partially_followed', 'violated', 'not_set');
CREATE TYPE journal_status AS ENUM ('not_started', 'in_progress', 'completed');

-- ============================================================
-- STRATEGIES TABLE
-- ============================================================

CREATE TABLE strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SETUPS TABLE
-- ============================================================

CREATE TABLE setups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TAGS TABLE
-- ============================================================

CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- ============================================================
-- MISTAKES TABLE
-- ============================================================

CREATE TABLE mistakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TRADE JOURNALS TABLE
-- ============================================================

CREATE TABLE trade_journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- References
  strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
  setup_id UUID REFERENCES setups(id) ON DELETE SET NULL,
  
  -- Pre-Trade Plan
  market_context TEXT,
  market_bias TEXT,
  timeframe TEXT,
  important_levels TEXT,
  confluences TEXT,
  entry_reason TEXT,
  expected_scenario TEXT,
  invalidating_condition TEXT,
  planned_risk_amount NUMERIC(15, 2),
  planned_risk_percentage NUMERIC(5, 2),
  planned_rr NUMERIC(5, 2),
  confidence INTEGER CHECK (confidence >= 1 AND confidence <= 10),
  checklist JSONB,
  
  -- Psychology
  emotion_before TEXT,
  emotion_during TEXT,
  emotion_after TEXT,
  
  -- Execution
  execution_quality INTEGER CHECK (execution_quality >= 1 AND execution_quality <= 10),
  rule_adherence rule_adherence NOT NULL DEFAULT 'not_set',
  rule_adherence_notes TEXT,
  
  -- Post-Trade Review
  what_went_well TEXT,
  what_went_wrong TEXT,
  lesson_learned TEXT,
  post_trade_notes TEXT,
  
  -- Status
  status journal_status NOT NULL DEFAULT 'not_started',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(trade_id)
);

-- ============================================================
-- TRADE TAGS (Many-to-Many)
-- ============================================================

CREATE TABLE trade_tags (
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (trade_id, tag_id)
);

-- ============================================================
-- TRADE MISTAKES (Many-to-Many)
-- ============================================================

CREATE TABLE trade_mistakes (
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  mistake_id UUID NOT NULL REFERENCES mistakes(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (trade_id, mistake_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Strategies
CREATE INDEX idx_strategies_user_id ON strategies(user_id);
CREATE INDEX idx_strategies_is_active ON strategies(is_active);

-- Setups
CREATE INDEX idx_setups_user_id ON setups(user_id);
CREATE INDEX idx_setups_strategy_id ON setups(strategy_id);
CREATE INDEX idx_setups_is_active ON setups(is_active);

-- Tags
CREATE INDEX idx_tags_user_id ON tags(user_id);

-- Mistakes
CREATE INDEX idx_mistakes_user_id ON mistakes(user_id);
CREATE INDEX idx_mistakes_is_active ON mistakes(is_active);

-- Trade Journals
CREATE INDEX idx_trade_journals_trade_id ON trade_journals(trade_id);
CREATE INDEX idx_trade_journals_user_id ON trade_journals(user_id);
CREATE INDEX idx_trade_journals_strategy_id ON trade_journals(strategy_id);
CREATE INDEX idx_trade_journals_setup_id ON trade_journals(setup_id);
CREATE INDEX idx_trade_journals_status ON trade_journals(status);
CREATE INDEX idx_trade_journals_rule_adherence ON trade_journals(rule_adherence);

-- Trade Tags
CREATE INDEX idx_trade_tags_trade_id ON trade_tags(trade_id);
CREATE INDEX idx_trade_tags_tag_id ON trade_tags(tag_id);

-- Trade Mistakes
CREATE INDEX idx_trade_mistakes_trade_id ON trade_mistakes(trade_id);
CREATE INDEX idx_trade_mistakes_mistake_id ON trade_mistakes(mistake_id);

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER update_strategies_updated_at
  BEFORE UPDATE ON strategies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_setups_updated_at
  BEFORE UPDATE ON setups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tags_updated_at
  BEFORE UPDATE ON tags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mistakes_updated_at
  BEFORE UPDATE ON mistakes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trade_journals_updated_at
  BEFORE UPDATE ON trade_journals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
