-- ============================================================
-- Migration: 001_initial_schema
-- Description: Create initial database schema for Forex Trading Journal
-- ============================================================

-- Enable UUID generation
-- (Supabase has this enabled by default, but including for completeness)

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE account_status AS ENUM ('active', 'passed', 'failed', 'funded', 'archived');
CREATE TYPE phase_status AS ENUM ('active', 'completed', 'failed', 'skipped');
CREATE TYPE phase_type AS ENUM ('challenge', 'phase1', 'phase2', 'funded', 'evaluation');

-- ============================================================
-- PROFILES TABLE
-- Extends auth.users with application-specific user data
-- ============================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Tehran',
  default_currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TRADING ACCOUNTS TABLE
-- Each user can have multiple trading accounts
-- ============================================================

CREATE TABLE trading_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  broker TEXT,
  platform TEXT,
  account_number_label TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  initial_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
  status account_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ACCOUNT PHASES TABLE
-- Each account can have multiple phases (challenge, phase1, etc.)
-- ============================================================

CREATE TABLE account_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phase_type phase_type NOT NULL DEFAULT 'challenge',
  status phase_status NOT NULL DEFAULT 'active',
  starting_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
  target_balance NUMERIC(15, 2),
  maximum_drawdown NUMERIC(15, 2),
  daily_drawdown_limit NUMERIC(15, 2),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Profile indexes
CREATE INDEX idx_profiles_created_at ON profiles(created_at);

-- Trading accounts indexes
CREATE INDEX idx_trading_accounts_user_id ON trading_accounts(user_id);
CREATE INDEX idx_trading_accounts_status ON trading_accounts(status);
CREATE INDEX idx_trading_accounts_created_at ON trading_accounts(created_at DESC);

-- Account phases indexes
CREATE INDEX idx_account_phases_account_id ON account_phases(account_id);
CREATE INDEX idx_account_phases_status ON account_phases(status);
CREATE INDEX idx_account_phases_created_at ON account_phases(created_at);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trading_accounts_updated_at
  BEFORE UPDATE ON trading_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_account_phases_updated_at
  BEFORE UPDATE ON account_phases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
