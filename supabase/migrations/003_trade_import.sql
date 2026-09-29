-- ============================================================
-- Migration: 003_trade_import
-- Description: Create trades and import_batches tables for MT4/MT5 import
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE trade_side AS ENUM ('buy', 'sell');
CREATE TYPE trade_source AS ENUM ('mt4', 'mt5', 'manual');
CREATE TYPE import_batch_status AS ENUM ('processing', 'completed', 'completed_with_warnings', 'failed');

-- ============================================================
-- IMPORT BATCHES TABLE
-- Tracks each import operation for auditability
-- ============================================================

CREATE TABLE import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES account_phases(id) ON DELETE SET NULL,
  source trade_source NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  total_rows INTEGER NOT NULL DEFAULT 0,
  valid_rows INTEGER NOT NULL DEFAULT 0,
  invalid_rows INTEGER NOT NULL DEFAULT 0,
  duplicate_rows INTEGER NOT NULL DEFAULT 0,
  imported_rows INTEGER NOT NULL DEFAULT 0,
  status import_batch_status NOT NULL DEFAULT 'processing',
  error_message TEXT,
  parser_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================================
-- TRADES TABLE
-- Stores imported and manual trades
-- ============================================================

CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES account_phases(id) ON DELETE SET NULL,
  import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL,
  
  -- Identification
  ticket TEXT,
  position_id TEXT,
  
  -- Trade details
  symbol TEXT NOT NULL,
  side trade_side NOT NULL,
  volume NUMERIC(15, 4) NOT NULL,
  
  -- Entry
  entry_datetime TIMESTAMPTZ NOT NULL,
  entry_price NUMERIC(15, 5) NOT NULL,
  stop_loss NUMERIC(15, 5),
  take_profit NUMERIC(15, 5),
  
  -- Exit
  exit_datetime TIMESTAMPTZ NOT NULL,
  exit_price NUMERIC(15, 5) NOT NULL,
  
  -- Financial
  commission NUMERIC(15, 2) DEFAULT 0,
  swap NUMERIC(15, 2) DEFAULT 0,
  profit NUMERIC(15, 2) NOT NULL,
  
  -- Metadata
  comment TEXT,
  magic_number INTEGER,
  
  -- Source tracking
  source trade_source NOT NULL,
  source_file TEXT,
  
  -- Duration (calculated)
  duration_seconds INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Import batches indexes
CREATE INDEX idx_import_batches_user_id ON import_batches(user_id);
CREATE INDEX idx_import_batches_account_id ON import_batches(account_id);
CREATE INDEX idx_import_batches_created_at ON import_batches(created_at DESC);
CREATE INDEX idx_import_batches_status ON import_batches(status);

-- Trades indexes
CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_trades_account_id ON trades(account_id);
CREATE INDEX idx_trades_phase_id ON trades(phase_id);
CREATE INDEX idx_trades_import_batch_id ON trades(import_batch_id);
CREATE INDEX idx_trades_symbol ON trades(symbol);
CREATE INDEX idx_trades_entry_datetime ON trades(entry_datetime DESC);
CREATE INDEX idx_trades_exit_datetime ON trades(exit_datetime DESC);
CREATE INDEX idx_trades_source ON trades(source);
CREATE INDEX idx_trades_side ON trades(side);

-- Composite indexes for common queries
CREATE INDEX idx_trades_user_account ON trades(user_id, account_id);
CREATE INDEX idx_trades_user_entry ON trades(user_id, entry_datetime DESC);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-calculate duration on insert/update
CREATE OR REPLACE FUNCTION calculate_trade_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.exit_datetime IS NOT NULL AND NEW.entry_datetime IS NOT NULL THEN
    NEW.duration_seconds := EXTRACT(EPOCH FROM (NEW.exit_datetime - NEW.entry_datetime))::INTEGER;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_trade_duration
  BEFORE INSERT OR UPDATE ON trades
  FOR EACH ROW
  EXECUTE FUNCTION calculate_trade_duration();

-- Auto-update updated_at timestamp
CREATE TRIGGER update_trades_updated_at
  BEFORE UPDATE ON trades
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_import_batches_updated_at
  BEFORE UPDATE ON import_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
