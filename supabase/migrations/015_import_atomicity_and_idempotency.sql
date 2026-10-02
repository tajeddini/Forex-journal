-- ============================================================
-- Migration: 015_import_atomicity_and_idempotency
-- Description: Enforce database-level idempotency, transactional batch import,
-- strict cross-user ownership invariants, and hardened RPC execution privileges.
-- Ensures:
-- 1. True idempotency: Prevents duplicate imports of MT4 tickets and MT5 positions per account
-- 2. Transactional atomicity: Single PostgreSQL transaction covers trade inserts AND batch completion
-- 3. Cross-user integrity: Caller auth.uid(), trading_account, import_batch, and account_phases verified
-- 4. Hardened security: SECURITY DEFINER with empty search_path, explicit object schema, and REVOKE from PUBLIC
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
  p_trades JSONB,
  p_final_status TEXT DEFAULT 'completed'
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
  v_batch_record RECORD;
BEGIN
  -- 1. Security Check: Authenticated caller must match p_user_id
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL OR v_caller_id <> p_user_id THEN
    RAISE EXCEPTION 'دسترسی غیرمجاز: شناسه کاربر معتبر نیست یا احراز هویت نشده است';
  END IF;

  -- 2. Ownership Check: Account must exist and belong to the authenticated user
  IF NOT EXISTS (
    SELECT 1 FROM public.trading_accounts
    WHERE id = p_account_id
      AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'حساب معاملاتی معتبر نیست یا متعلق به شما نمی‌باشد';
  END IF;

  -- 3. Ownership & State Check: Import batch must exist, belong to user and account, and be in 'processing' status
  SELECT * INTO v_batch_record
  FROM public.import_batches
  WHERE id = p_batch_id
    AND user_id = p_user_id
    AND account_id = p_account_id;

  IF v_batch_record.id IS NULL THEN
    RAISE EXCEPTION 'دسته ورود معتبر نیست یا متعلق به این حساب نمی‌باشد';
  END IF;

  IF v_batch_record.status <> 'processing' THEN
    RAISE EXCEPTION 'دسته ورود در وضعیت معتبر برای ثبت اطلاعات نیست (وضعیت فعلی: %)', v_batch_record.status;
  END IF;

  -- 4. Atomic Trade Inserts & Phase Validations within the same transaction
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
    -- Required field validation
    IF v_trade.symbol IS NULL OR pg_catalog.trim(v_trade.symbol) = '' THEN
      RAISE EXCEPTION 'نماد معامله نمی‌تواند خالی باشد';
    END IF;

    IF v_trade.side IS NULL THEN
      RAISE EXCEPTION 'جهت معامله (buy/sell) الزامی است';
    END IF;

    IF v_trade.volume IS NULL OR v_trade.volume <= 0 THEN
      RAISE EXCEPTION 'حجم معامله باید مقداری مثبت باشد';
    END IF;

    IF v_trade.entry_datetime IS NULL THEN
      RAISE EXCEPTION 'زمان ورود معامله الزامی است';
    END IF;

    -- Phase Ownership Validation: Phase must belong to the exact account
    IF v_trade.phase_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.account_phases
        WHERE id = v_trade.phase_id
          AND account_id = p_account_id
      ) THEN
        RAISE EXCEPTION 'فاز معاملاتی انتخاب شده (%) متعلق به حساب معاملاتی مورد نظر نیست', v_trade.phase_id;
      END IF;
    END IF;

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
      pg_catalog.trim(v_trade.symbol),
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
      COALESCE(v_trade.profit, 0),
      v_trade.comment,
      v_trade.magic_number,
      COALESCE(v_trade.source, 'mt5'),
      v_trade.source_file
    );

    v_inserted_count := v_inserted_count + 1;
  END LOOP;

  -- 5. Complete the batch in the exact same transaction
  UPDATE public.import_batches
  SET
    imported_rows = v_inserted_count,
    status = p_final_status::public.import_batch_status,
    completed_at = pg_catalog.now()
  WHERE id = p_batch_id;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'batch_id', p_batch_id,
    'inserted_count', v_inserted_count,
    'status', p_final_status
  );
END;
$$;

-- 4. Strict Permission Hardening: Revoke execution from PUBLIC, grant only to authenticated and service_role
REVOKE ALL ON FUNCTION public.import_trades_transactional(UUID, UUID, UUID, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_trades_transactional(UUID, UUID, UUID, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_trades_transactional(UUID, UUID, UUID, JSONB, TEXT) TO service_role;

-- 5. Harden screenshot helper function execution
REVOKE ALL ON FUNCTION public.check_trade_screenshot_ownership(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_trade_screenshot_ownership(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_trade_screenshot_ownership(TEXT) TO service_role;
