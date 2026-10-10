-- These functions already enforce auth.uid() and operate only on rows owned by
-- the caller. Running them as the invoker keeps normal RLS policies in force
-- and avoids SECURITY DEFINER privilege escalation.
ALTER FUNCTION public.check_trade_screenshot_ownership(text) SECURITY INVOKER;
ALTER FUNCTION public.import_trades_transactional(uuid, uuid, text, jsonb, uuid) SECURITY INVOKER;
