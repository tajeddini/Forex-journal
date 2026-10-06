-- 018_production_migration_reconciliation
-- Reconciles production state without downgrading the duration-aware import RPC.
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trades_mt4_account_ticket_unique
  ON public.trades (account_id, ticket)
  WHERE ticket IS NOT NULL AND source = 'mt4';

CREATE UNIQUE INDEX IF NOT EXISTS idx_trades_mt5_account_position_unique
  ON public.trades (account_id, position_id)
  WHERE position_id IS NOT NULL AND source = 'mt5';

-- Production already contains the hardened duration-aware RPC from migration 017.
-- This migration intentionally does not replace that function.

REVOKE ALL
  ON FUNCTION public.import_trades_transactional(UUID, UUID, TEXT, JSONB, UUID)
  FROM PUBLIC, anon;

GRANT EXECUTE
  ON FUNCTION public.import_trades_transactional(UUID, UUID, TEXT, JSONB, UUID)
  TO authenticated, service_role;

REVOKE EXECUTE
  ON FUNCTION public.check_trade_screenshot_ownership(TEXT)
  FROM PUBLIC, anon;

GRANT EXECUTE
  ON FUNCTION public.check_trade_screenshot_ownership(TEXT)
  TO authenticated, service_role;

COMMIT;