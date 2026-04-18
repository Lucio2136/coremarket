-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 20260411000002: Aplica todos los fixes del backend
-- Versión corregida de 20260409000003_backend_fixes.sql
-- Diferencia: DROP VIEW antes de recrearla (evita error 42P16)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 1: set_system_freeze con guard de admin
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_system_freeze(p_frozen BOOLEAN, p_admin_email TEXT)
RETURNS JSON AS $$
DECLARE
  v_caller_email TEXT;
BEGIN
  v_caller_email := auth.jwt() ->> 'email';
  IF v_caller_email NOT IN ('outfisin@gmail.com') THEN
    RAISE EXCEPTION 'Acceso denegado: solo el administrador puede cambiar el estado del sistema'
      USING ERRCODE = 'P0003';
  END IF;

  UPDATE system_settings
  SET
    is_frozen = p_frozen,
    frozen_at = CASE WHEN p_frozen THEN now() ELSE NULL END,
    frozen_by = CASE WHEN p_frozen THEN p_admin_email ELSE NULL END
  WHERE id = true;

  RETURN json_build_object(
    'is_frozen', p_frozen,
    'frozen_at', CASE WHEN p_frozen THEN now() ELSE NULL END,
    'frozen_by', CASE WHEN p_frozen THEN p_admin_email ELSE NULL END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 2: Trigger freeze — excluir refunds y wins del bloqueo
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_system_not_frozen()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'bets' THEN
    IF (SELECT is_frozen FROM system_settings WHERE id = true) THEN
      RAISE EXCEPTION 'SISTEMA_CONGELADO: Apuestas suspendidas temporalmente.';
    END IF;
  ELSIF TG_TABLE_NAME = 'transactions' THEN
    IF NEW.type IN ('bet', 'deposit') THEN
      IF (SELECT is_frozen FROM system_settings WHERE id = true) THEN
        RAISE EXCEPTION 'SISTEMA_CONGELADO: Operaciones suspendidas temporalmente.';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'withdrawals' THEN
    IF TG_OP = 'INSERT' THEN
      IF (SELECT is_frozen FROM system_settings WHERE id = true) THEN
        RAISE EXCEPTION 'SISTEMA_CONGELADO: Retiros suspendidos temporalmente.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_bets_freeze_check         ON bets;
DROP TRIGGER IF EXISTS trg_transactions_freeze_check ON transactions;
DROP TRIGGER IF EXISTS trg_withdrawals_freeze_check  ON withdrawals;

CREATE TRIGGER trg_bets_freeze_check
  BEFORE INSERT ON bets
  FOR EACH ROW EXECUTE FUNCTION check_system_not_frozen();

CREATE TRIGGER trg_transactions_freeze_check
  BEFORE INSERT ON transactions
  FOR EACH ROW EXECUTE FUNCTION check_system_not_frozen();

CREATE TRIGGER trg_withdrawals_freeze_check
  BEFORE INSERT OR UPDATE ON withdrawals
  FOR EACH ROW EXECUTE FUNCTION check_system_not_frozen();


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 3 + 4: resolve_market y place_bet
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.resolve_market(uuid, text);

CREATE OR REPLACE FUNCTION public.resolve_market(
  p_market_id    uuid,
  p_winning_side text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id     uuid;
  v_caller_email  text;
  v_market_status text;
  v_bet           record;
  v_balance_after numeric;
  v_winners_paid  int     := 0;
  v_total_payout  numeric := 0;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = 'P0001';
  END IF;

  SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller_id;
  IF v_caller_email NOT IN ('outfisin@gmail.com') THEN
    RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = 'P0003';
  END IF;

  IF p_winning_side NOT IN ('yes', 'no') THEN
    RAISE EXCEPTION 'Lado ganador inválido' USING ERRCODE = 'P0001';
  END IF;

  SELECT status INTO v_market_status FROM public.markets WHERE id = p_market_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mercado no encontrado' USING ERRCODE = 'P0001';
  END IF;
  IF v_market_status <> 'open' THEN
    RAISE EXCEPTION 'El mercado ya está cerrado' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.markets SET status = 'closed', result = p_winning_side WHERE id = p_market_id;

  UPDATE public.bets SET status = 'lost'
  WHERE market_id = p_market_id AND side <> p_winning_side AND status = 'pending';

  FOR v_bet IN
    SELECT b.id, b.user_id, b.potential_payout
    FROM   public.bets b
    WHERE  b.market_id = p_market_id AND b.side = p_winning_side AND b.status = 'pending'
    ORDER  BY b.user_id FOR UPDATE
  LOOP
    UPDATE public.profiles
    SET    balance_mxn = balance_mxn + v_bet.potential_payout,
           total_won   = COALESCE(total_won, 0) + v_bet.potential_payout
    WHERE  id = v_bet.user_id
    RETURNING balance_mxn INTO v_balance_after;

    UPDATE public.bets SET status = 'won' WHERE id = v_bet.id;

    INSERT INTO public.transactions (user_id, type, amount, balance_after)
    VALUES (v_bet.user_id, 'win', v_bet.potential_payout, v_balance_after);

    v_winners_paid := v_winners_paid + 1;
    v_total_payout := v_total_payout + v_bet.potential_payout;
  END LOOP;

  RETURN json_build_object(
    'market_id', p_market_id, 'result', p_winning_side,
    'winners_paid', v_winners_paid, 'total_payout', v_total_payout
  );
END;
$$;

REVOKE ALL    ON FUNCTION public.resolve_market(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_market(uuid, text) TO authenticated;


DROP FUNCTION IF EXISTS public.place_bet(uuid, text, numeric, numeric);

CREATE OR REPLACE FUNCTION public.place_bet(
  p_market_id uuid,
  p_side      text,
  p_amount    numeric,
  p_odds      numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  k_virtual       CONSTANT numeric := 200;
  k_fee_rate      CONSTANT numeric := 0.03;
  v_user_id          uuid;
  v_balance          numeric;
  v_market           record;
  v_raw_payout       numeric;
  v_fee_amount       numeric;
  v_potential_payout numeric;
  v_bet_id           uuid;
  v_balance_after    numeric;
  v_new_yes_pool     numeric;
  v_new_no_pool      numeric;
  v_yes_eff          numeric;
  v_no_eff           numeric;
  v_total_eff        numeric;
  v_new_yes_pct      numeric;
  v_new_yes_odds     numeric;
  v_new_no_odds      numeric;
  v_current_odds     numeric;
  v_already_bet      boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = 'P0001';
  END IF;

  IF p_amount < 10 THEN
    RAISE EXCEPTION 'El monto mínimo de apuesta es $10 MXN' USING ERRCODE = 'P0001';
  END IF;
  IF p_side NOT IN ('yes', 'no') THEN
    RAISE EXCEPTION 'Lado inválido' USING ERRCODE = 'P0001';
  END IF;
  IF p_odds <= 1 THEN
    RAISE EXCEPTION 'Cuota inválida' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, status, closes_at, yes_pool, no_pool, total_pool, bettor_count
  INTO   v_market FROM public.markets WHERE id = p_market_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mercado no encontrado' USING ERRCODE = 'P0001';
  END IF;
  IF v_market.status <> 'open' THEN
    RAISE EXCEPTION 'El mercado está cerrado' USING ERRCODE = 'P0001';
  END IF;
  IF v_market.closes_at IS NOT NULL AND v_market.closes_at < NOW() THEN
    UPDATE public.markets SET status = 'closed' WHERE id = p_market_id;
    RAISE EXCEPTION 'El mercado ya expiró' USING ERRCODE = 'P0001';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.bets WHERE market_id = p_market_id AND user_id = v_user_id
  ) INTO v_already_bet;

  v_yes_eff   := v_market.yes_pool + k_virtual;
  v_no_eff    := v_market.no_pool  + k_virtual;
  v_total_eff := v_yes_eff + v_no_eff;

  IF p_side = 'yes' THEN
    v_current_odds := ROUND(v_total_eff / v_yes_eff, 4);
  ELSE
    v_current_odds := ROUND(v_total_eff / v_no_eff, 4);
  END IF;

  IF ABS(p_odds - v_current_odds) / v_current_odds > 0.10 THEN
    RAISE EXCEPTION 'Las cuotas han cambiado (%.2f → %.2f). Recarga y vuelve a intentarlo.',
      p_odds, v_current_odds USING ERRCODE = 'P0001';
  END IF;

  SELECT balance_mxn INTO v_balance FROM public.profiles WHERE id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil no encontrado' USING ERRCODE = 'P0001';
  END IF;
  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente. Saldo actual: $% MXN', round(v_balance, 2)
      USING ERRCODE = 'P0001';
  END IF;

  v_raw_payout       := ROUND(p_amount * v_current_odds, 2);
  v_fee_amount       := ROUND(v_raw_payout * k_fee_rate, 2);
  v_potential_payout := v_raw_payout - v_fee_amount;
  v_balance_after    := v_balance - p_amount;

  UPDATE public.profiles
  SET    balance_mxn = v_balance_after,
         total_bet   = COALESCE(total_bet, 0) + p_amount
  WHERE  id = v_user_id;

  INSERT INTO public.bets (
    user_id, market_id, side, amount, odds_at_bet,
    potential_payout, fee_amount, status
  )
  VALUES (
    v_user_id, p_market_id, p_side, p_amount, v_current_odds,
    v_potential_payout, v_fee_amount, 'pending'
  )
  RETURNING id INTO v_bet_id;

  IF p_side = 'yes' THEN
    v_new_yes_pool := v_market.yes_pool + p_amount;
    v_new_no_pool  := v_market.no_pool;
  ELSE
    v_new_yes_pool := v_market.yes_pool;
    v_new_no_pool  := v_market.no_pool + p_amount;
  END IF;

  v_yes_eff      := v_new_yes_pool + k_virtual;
  v_no_eff       := v_new_no_pool  + k_virtual;
  v_total_eff    := v_yes_eff + v_no_eff;
  v_new_yes_pct  := ROUND(v_yes_eff / v_total_eff * 100, 1);
  v_new_yes_odds := GREATEST(1.01, ROUND(v_total_eff / v_yes_eff, 2));
  v_new_no_odds  := GREATEST(1.01, ROUND(v_total_eff / v_no_eff,  2));

  UPDATE public.markets
  SET
    yes_pool     = v_new_yes_pool,
    no_pool      = v_new_no_pool,
    total_pool   = v_market.total_pool + p_amount,
    bettor_count = v_market.bettor_count + CASE WHEN v_already_bet THEN 0 ELSE 1 END,
    yes_percent  = v_new_yes_pct,
    yes_odds     = v_new_yes_odds,
    no_odds      = v_new_no_odds
  WHERE id = p_market_id;

  INSERT INTO public.transactions (user_id, type, amount, balance_after)
  VALUES (v_user_id, 'bet', -p_amount, v_balance_after);

  RETURN json_build_object(
    'bet_id', v_bet_id, 'market_id', p_market_id, 'side', p_side,
    'amount', p_amount, 'odds_at_bet', v_current_odds,
    'fee_amount', v_fee_amount, 'potential_payout', v_potential_payout,
    'status', 'pending', 'new_yes_odds', v_new_yes_odds,
    'new_no_odds', v_new_no_odds, 'new_yes_percent', v_new_yes_pct
  );
END;
$$;

REVOKE ALL    ON FUNCTION public.place_bet(uuid, text, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_bet(uuid, text, numeric, numeric) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 5: admin_financial_stats — solo service_role
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE SELECT ON public.admin_financial_stats FROM authenticated;
GRANT  SELECT ON public.admin_financial_stats TO service_role;

CREATE OR REPLACE FUNCTION public.get_financial_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_row   record;
BEGIN
  v_email := auth.jwt() ->> 'email';
  IF v_email NOT IN ('outfisin@gmail.com') THEN
    RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = 'P0003';
  END IF;

  SELECT * INTO v_row FROM public.admin_financial_stats;
  RETURN row_to_json(v_row);
END;
$$;

REVOKE ALL    ON FUNCTION public.get_financial_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_financial_stats() TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 6: Auto-cierre de mercados expirados
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.close_expired_markets()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.markets
  SET    status = 'closed'
  WHERE  status = 'open' AND closes_at IS NOT NULL AND closes_at < NOW();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN json_build_object('closed', v_count, 'run_at', now());
END;
$$;

REVOKE ALL    ON FUNCTION public.close_expired_markets() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_expired_markets() TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_auto_close_expired_market()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'open' AND NEW.closes_at IS NOT NULL AND NEW.closes_at < NOW() THEN
    NEW.status := 'closed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_close_expired ON public.markets;
CREATE TRIGGER trg_auto_close_expired
  BEFORE UPDATE ON public.markets
  FOR EACH ROW EXECUTE FUNCTION public.trg_auto_close_expired_market();


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 7: Constraint transactions.type + reject_withdrawal con 'refund'
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('deposit', 'bet', 'win', 'withdrawal', 'refund'));


DROP FUNCTION IF EXISTS public.reject_withdrawal(uuid);

CREATE OR REPLACE FUNCTION public.reject_withdrawal(
  p_withdrawal_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  k_admin_emails  CONSTANT text[] := ARRAY['outfisin@gmail.com'];
  v_caller_email  text;
  v_withdrawal    record;
  v_balance_now   numeric;
  v_balance_after numeric;
BEGIN
  v_caller_email := auth.jwt() ->> 'email';
  IF NOT (v_caller_email = ANY (k_admin_emails)) THEN
    RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, user_id, amount, status
  INTO   v_withdrawal FROM public.withdrawals WHERE id = p_withdrawal_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud no encontrada' USING ERRCODE = 'P0001';
  END IF;
  IF v_withdrawal.status <> 'pending' THEN
    RAISE EXCEPTION 'Este retiro ya fue procesado (estado: %)', v_withdrawal.status
      USING ERRCODE = 'P0001';
  END IF;

  SELECT balance_mxn INTO v_balance_now FROM public.profiles
  WHERE id = v_withdrawal.user_id FOR UPDATE;

  v_balance_after := v_balance_now + v_withdrawal.amount;

  UPDATE public.profiles SET balance_mxn = v_balance_after WHERE id = v_withdrawal.user_id;
  UPDATE public.withdrawals SET status = 'rejected', updated_at = now() WHERE id = p_withdrawal_id;

  INSERT INTO public.transactions (user_id, type, amount, balance_after)
  VALUES (v_withdrawal.user_id, 'refund', v_withdrawal.amount, v_balance_after);

  RETURN json_build_object(
    'withdrawal_id', p_withdrawal_id,
    'status',        'rejected',
    'refunded',      v_withdrawal.amount,
    'balance_after', v_balance_after
  );
END;
$$;

REVOKE ALL    ON FUNCTION public.reject_withdrawal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_withdrawal(uuid) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- Recrear admin_financial_stats con DROP + CREATE (evita error 42P16)
-- ─────────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.admin_financial_stats;

CREATE VIEW public.admin_financial_stats AS
SELECT
  COALESCE((SELECT SUM(amount)   FROM public.transactions WHERE type = 'deposit'),   0) AS total_deposits,
  COALESCE((SELECT SUM(-amount)  FROM public.transactions WHERE type = 'bet'),        0) AS total_bets_volume,
  COALESCE((SELECT SUM(amount)   FROM public.transactions WHERE type = 'win'),        0) AS total_wins_paid,
  COALESCE((SELECT SUM(-amount)  FROM public.transactions WHERE type = 'bet'),        0) -
  COALESCE((SELECT SUM(amount)   FROM public.transactions WHERE type = 'win'),        0) AS net_profit,
  COALESCE((SELECT SUM(fee_amount) FROM public.bets WHERE status = 'won'),            0) AS house_fee_realized,
  COALESCE((SELECT SUM(fee_amount) FROM public.bets WHERE status IN ('won','pending')),0) AS house_fee_expected,
  COALESCE((SELECT SUM(potential_payout) FROM public.bets WHERE status = 'pending'),  0) AS liability,
  COALESCE((SELECT SUM(amount)   FROM public.transactions WHERE type = 'refund'),     0) AS total_refunds,
  (SELECT COUNT(*)::int FROM public.profiles)                                            AS total_users,
  (SELECT COUNT(*)::int FROM public.markets WHERE status = 'open')                       AS active_markets,
  (SELECT COUNT(*)::int FROM public.bets    WHERE status = 'pending')                    AS pending_bets;

GRANT SELECT ON public.admin_financial_stats TO service_role;
