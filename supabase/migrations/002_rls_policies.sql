-- ============================================================
-- Migration: 002_rls_policies
-- Description: Enable Row Level Security on all user-owned tables
-- ============================================================

-- ============================================================
-- ENABLE RLS
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_phases ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES POLICIES
-- Users can only access their own profile
-- ============================================================

-- Select: Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Insert: Users can create their own profile (handled by trigger too)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Update: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Delete: Users can delete their own profile
CREATE POLICY "Users can delete own profile"
  ON profiles FOR DELETE
  USING (auth.uid() = id);

-- ============================================================
-- TRADING ACCOUNTS POLICIES
-- Users can only access accounts they own
-- ============================================================

-- Select: Users can read their own accounts
CREATE POLICY "Users can view own accounts"
  ON trading_accounts FOR SELECT
  USING (auth.uid() = user_id);

-- Insert: Users can create accounts (user_id must match)
CREATE POLICY "Users can create own accounts"
  ON trading_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Update: Users can update their own accounts
CREATE POLICY "Users can update own accounts"
  ON trading_accounts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Delete: Users can delete their own accounts
CREATE POLICY "Users can delete own accounts"
  ON trading_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- ACCOUNT PHASES POLICIES
-- Access is derived through ownership of the parent account
-- ============================================================

-- Select: Users can read phases of their own accounts
CREATE POLICY "Users can view phases of own accounts"
  ON account_phases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trading_accounts
      WHERE trading_accounts.id = account_phases.account_id
      AND trading_accounts.user_id = auth.uid()
    )
  );

-- Insert: Users can create phases for their own accounts
CREATE POLICY "Users can create phases for own accounts"
  ON account_phases FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trading_accounts
      WHERE trading_accounts.id = account_phases.account_id
      AND trading_accounts.user_id = auth.uid()
    )
  );

-- Update: Users can update phases of their own accounts
CREATE POLICY "Users can update phases of own accounts"
  ON account_phases FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM trading_accounts
      WHERE trading_accounts.id = account_phases.account_id
      AND trading_accounts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trading_accounts
      WHERE trading_accounts.id = account_phases.account_id
      AND trading_accounts.user_id = auth.uid()
    )
  );

-- Delete: Users can delete phases of their own accounts
CREATE POLICY "Users can delete phases of own accounts"
  ON account_phases FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trading_accounts
      WHERE trading_accounts.id = account_phases.account_id
      AND trading_accounts.user_id = auth.uid()
    )
  );
