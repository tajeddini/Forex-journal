-- 017_backfill_trade_duration_and_harden_import
BEGIN;

-- Backfill duration for historical imported trades where both timestamps exist.
UPDATE public.trades
SET duration_seconds = GREATEST(
  0,
  FLOOR(EXTRACT(EPOCH FROM (exit_datetime - entry_datetime)))::BIGINT
)
WHERE duration_seconds IS NULL
  AND entry_datetime IS NOT NULL
  AND exit_datetime IS NOT NULL;

-- Keep duration populated for future imports when the client omits it.
CREATE OR REPLACE FUNCTION public.import_trades_transactional(
  p_account_id UUID,
  p_batch_id UUID,
  p_final_status TEXT DEFAULT 'completed',
  p_trades JSONB DEFAULT '[]'::jsonb,
  p_user_id UUID DEFAULT NULL
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
  v_source public.trade_source;
  v_duration_seconds BIGINT;
BEGIN
  v_caller_id := auth.uid();

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'دسترسی غیرمجاز: کاربر احراز هویت نشده است';
  END IF;

  IF p_user_id IS NULL OR v_caller_id <> p_user_id THEN
    RAISE EXCEPTION 'دسترسی غیرمجاز: شناسه کاربر معتبر نیست';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.trading_accounts
    WHERE id = p_account_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'حساب معاملاتی معتبر نیست یا متعلق به کاربر نیست';
  END IF;

  SELECT * INTO v_batch_record
  FROM public.import_batches
  WHERE id = p_batch_id
    AND user_id = p_user_id
    AND account_id = p_account_id
  FOR UPDATE;

  IF v_batch_record.id IS NULL THEN
    RAISE EXCEPTION 'دسته ورود معتبر نیست یا متعلق به این حساب نیست';
  END IF;

  IF v_batch_record.status <> 'processing'::public.import_batch_status THEN
    RAISE EXCEPTION 'دسته ورود در وضعیت معتبر برای ثبت اطلاعات نیست (وضعیت فعلی: %)', v_batch_record.status;
  END IF;

  PERFORM p_final_status::public.import_batch_status;

  IF jsonb_typeof(COALESCE(p_trades, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'p_trades باید یک آرایه JSON باشد';
  END IF;

  FOR v_trade IN
    SELECT *
    FROM pg_catalog.jsonb_to_recordset(COALESCE(p_trades, '[]'::jsonb)) AS x(
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
      magic_number BIGINT,
      source public.trade_source,
      source_file TEXT,
      phase_id UUID,
      duration_seconds BIGINT
    )
  LOOP
    IF v_trade.symbol IS NULL OR pg_catalog.btrim(v_trade.symbol) = '' THEN
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
    IF v_trade.entry_price IS NULL THEN
      RAISE EXCEPTION 'قیمت ورود معامله الزامی است';
    END IF;
    IF v_trade.exit_datetime IS NULL THEN
      RAISE EXCEPTION 'زمان خروج معامله الزامی است';
    END IF;
    IF v_trade.exit_price IS NULL THEN
      RAISE EXCEPTION 'قیمت خروج معامله الزامی است';
    END IF;

    IF v_trade.phase_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.account_phases
         WHERE id = v_trade.phase_id AND account_id = p_account_id
       )
    THEN
      RAISE EXCEPTION 'فاز معاملاتی انتخاب شده متعلق به حساب معاملاتی مورد نظر نیست';
    END IF;

    v_source := COALESCE(v_trade.source, 'mt5'::public.trade_source);

    v_duration_seconds := v_trade.duration_seconds;
    IF v_duration_seconds IS NULL THEN
      v_duration_seconds := GREATEST(
        0,
        FLOOR(EXTRACT(EPOCH FROM (v_trade.exit_datetime - v_trade.entry_datetime)))::BIGINT
      );
    END IF;

    INSERT INTO public.trades (
      user_id, account_id, phase_id, import_batch_id,
      ticket, position_id, symbol, side, volume,
      entry_datetime, entry_price, stop_loss, take_profit,
      exit_datetime, exit_price, commission, swap, profit,
      comment, magic_number, source, source_file, duration_seconds
    )
    VALUES (
      p_user_id, p_account_id, v_trade.phase_id, p_batch_id,
      v_trade.ticket, v_trade.position_id, pg_catalog.btrim(v_trade.symbol),
      v_trade.side, v_trade.volume, v_trade.entry_datetime, v_trade.entry_price,
      v_trade.stop_loss, v_trade.take_profit, v_trade.exit_datetime, v_trade.exit_price,
      COALESCE(v_trade.commission, 0), COALESCE(v_trade.swap, 0),
      COALESCE(v_trade.profit, 0), v_trade.comment, v_trade.magic_number,
      v_source, v_trade.source_file, v_duration_seconds
    )
    ON CONFLICT DO NOTHING;

    IF FOUND THEN
      v_inserted_count := v_inserted_count + 1;
    END IF;
  END LOOP;

  UPDATE public.import_batches
  SET imported_rows = v_inserted_count,
      status = p_final_status::public.import_batch_status,
      completed_at = pg_catalog.now(),
      error_message = NULL
  WHERE id = p_batch_id
    AND user_id = p_user_id
    AND account_id = p_account_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'دسته ورود هنگام تکمیل پیدا نشد';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'batch_id', p_batch_id,
    'inserted_count', v_inserted_count,
    'status', p_final_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.import_trades_transactional(UUID, UUID, TEXT, JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_trades_transactional(UUID, UUID, TEXT, JSONB, UUID) TO authenticated, service_role;

COMMIT;