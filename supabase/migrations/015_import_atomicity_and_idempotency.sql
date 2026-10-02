-- ============================================================
-- Migration: 015_import_atomicity_and_idempotency
-- Description: Enforce database-level idempotency and transactional batch import
-- Ensures:
-- 1. True idempotency: Prevents duplicate imports of MT4 tickets and MT5 positions per account
-- 2. Transactional atomicity: RPC function imports trades atomically within a single PG transaction
-- 3. Fail-safe rollback: If any trade fails, the transaction is automatically aborted with 0 partial records
-- ============================================================

-- 1. Partial unique index for MT4 (broker ticket uniqueness per account)
CREATE UNIQUE INDEX IF NOT EXISTS idx_trades_mt4_account_ticket_unique
  ON public.trades(account_id, ticket)
  WHERE ticket IS NOT NULL AND source = 'mt4';

-- 2. Partial unique index for MT5 (broker position ID uniqueness per account)
CREATE UNIQUE INDEX IF NOT EXISTS idx_trades_mt5_account_position_unique
  ON public.trades(account_id, position_id)
  WHERE position_id IS NOT NULL AND source = 'mt5';

-- 3. Transactional atomic import function
CREATE OR REPLACE FUNCTION public.import_trades_transactional(
  p_batch_id UUID,
  p_user_id UUID,
  p_account_id UUID,
  p_trades JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_inserted_count INTEGER := 0;
  v_trade RECORD;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL OR v_caller_id <> p_user_id THEN
    RAISE EXCEPTION 'دسترسی غیرمجاز: شناسه کاربر معتبر نیست';
  END IF;

  -- Validate batch exists and belongs to the caller
  IF NOT EXISTS (
    SELECT 1 FROM public.import_batches
    WHERE id = p_batch_id
      AND user_id = p_user_id
      AND account_id = p_account_id
  ) THEN
    RAISE EXCEPTION 'دسته ورود معتبر نیست یا متعلق به شما نمی‌باشد';
  END IF;

  -- Iterate through trades and insert atomically
  FOR v_trade IN SELECT * FROM pg_catalog.jsonb_to_recordset(p_trades) AS x(
    ticket TEXT,
    position_id TEXT,
    symbol TEXT,
    side public.trade_side,
    volume NUMERIC,
    entry_datetime TIMESTAMPTZ,
    entry_price NUMERIC,
    stop_loss NUMERIC,
    take_profit NUMERIC,
    exit_datetime TIMESTAMPTZ,
    exit_price NUMERIC,
    commission NUMERIC,
    swap NUMERIC,
    profit NUMERIC,
    comment TEXT,
    magic_number INTEGER,
    source public.trade_source,
    source_file TEXT,
    phase_id UUID
  )
  LOOP
    INSERT INTO public.trades (
      user_id,
      account_id,
      phase_id,
      import_batch_id,
      ticket,
      position_id,
      symbol,
      side,
      volume,
      entry_datetime,
      entry_price,
      stop_loss,
      take_profit,
      exit_datetime,
      exit_price,
      commission,
      swap,
      profit,
      comment,
      magic_number,
      source,
      source_file
    ) VALUES (
      p_user_id,
      p_account_id,
      v_trade.phase_id,
      p_batch_id,
      v_trade.ticket,
      v_trade.position_id,
      v_trade.symbol,
      v_trade.side,
      v_trade.volume,
      v_trade.entry_datetime,
      v_trade.entry_price,
      v_trade.stop_loss,
      v_trade.take_profit,
      v_trade.exit_datetime,
      v_trade.exit_price,
      COALESCE(v_trade.commission, 0),
      COALESCE(v_trade.swap, 0),
      v_trade.profit,
      v_trade.comment,
      v_trade.magic_number,
      v_trade.source,
      v_trade.source_file
    );
    v_inserted_count := v_inserted_count + 1;
  END LOOP;

  RETURN pg_catalog.jsonb_build_object('success', true, 'inserted_count', v_inserted_count);
END;
$$;
