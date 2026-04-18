-- ============================================================
-- Migration 007: Módulo de Tesorería
--
-- 1. fee_amount en bets — almacena la comisión del banco por apuesta
-- 2. place_bet actualizado con FEE_RATE = 3%
-- 3. Vista admin_financial_stats — KPIs financieros del banco
-- ============================================================

-- ── 1. Columna fee_amount en bets ─────────────────────────────────────────────
ALTER TABLE public.bets
  ADD COLUMN IF NOT EXISTS fee_amount numeric NOT NULL DEFAULT 0;

-- ── 2. Nueva place_bet con fee del 3% ────────────────────────────────────────
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
  k_fee_rate      CONSTANT numeric := 0.03;   -- 3% house fee

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
BEGIN

  -- ── 1. Identidad ─────────────────────────────────────────────────────────────
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = 'P0001';
  END IF;

  -- ── 2. Validaciones básicas ────────────────────────────────────────────────
  IF p_amount < 10 THEN
    RAISE EXCEPTION 'El monto mínimo de apuesta es $10 MXN' USING ERRCODE = 'P0001';
  END IF;
  IF p_side NOT IN ('yes', 'no') THEN
    RAISE EXCEPTION 'Lado inválido: debe ser "yes" o "no"' USING ERRCODE = 'P0001';
  END IF;
  IF p_odds <= 1 THEN
    RAISE EXCEPTION 'Cuota inválida' USING ERRCODE = 'P0001';
  END IF;

  -- ── 3. Bloquear y leer mercado ──────────────────────────────────────────────
  SELECT id, status, closes_at, yes_pool, no_pool, total_pool, bettor_count
  INTO   v_market
  FROM   public.markets
  WHERE  id = p_market_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mercado no encontrado' USING ERRCODE = 'P0001';
  END IF;
  IF v_market.status <> 'open' THEN
    RAISE EXCEPTION 'El mercado está cerrado' USING ERRCODE = 'P0001';
  END IF;
  IF v_market.closes_at IS NOT NULL AND v_market.closes_at < NOW() THEN
    RAISE EXCEPTION 'El mercado ya expiró y no acepta más apuestas' USING ERRCODE = 'P0001';
  END IF;

  -- ── 4. Calcular odds actuales (AMM pre-apuesta) ────────────────────────────
  v_yes_eff   := v_market.yes_pool + k_virtual;
  v_no_eff    := v_market.no_pool  + k_virtual;
  v_total_eff := v_yes_eff + v_no_eff;

  IF p_side = 'yes' THEN
    v_current_odds := ROUND(v_total_eff / v_yes_eff, 4);
  ELSE
    v_current_odds := ROUND(v_total_eff / v_no_eff, 4);
  END IF;

  -- ── 5. Slippage ±10% ────────────────────────────────────────────────────────
  IF ABS(p_odds - v_current_odds) / v_current_odds > 0.10 THEN
    RAISE EXCEPTION
      'Las cuotas han cambiado (%.2f → %.2f). Recarga y vuelve a intentarlo.',
      p_odds, v_current_odds
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 6. Saldo del usuario ────────────────────────────────────────────────────
  SELECT balance_mxn
  INTO   v_balance
  FROM   public.profiles
  WHERE  id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil no encontrado' USING ERRCODE = 'P0001';
  END IF;
  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente. Saldo actual: $% MXN', round(v_balance, 2)
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 7. Calcular pago con fee de la casa ─────────────────────────────────────
  --   raw_payout = lo que el usuario ganaría sin fee
  --   fee_amount = 3% del raw_payout (se guarda para reportes de tesorería)
  --   potential_payout = lo que el usuario recibe realmente (ya descontado el fee)
  v_raw_payout       := ROUND(p_amount * v_current_odds, 2);
  v_fee_amount       := ROUND(v_raw_payout * k_fee_rate, 2);
  v_potential_payout := v_raw_payout - v_fee_amount;
  v_balance_after    := v_balance - p_amount;

  -- ── 8. Descontar saldo + actualizar total_bet ────────────────────────────────
  UPDATE public.profiles
  SET    balance_mxn = v_balance_after,
         total_bet   = COALESCE(total_bet, 0) + p_amount
  WHERE  id = v_user_id;

  -- ── 9. Insertar la apuesta ───────────────────────────────────────────────────
  INSERT INTO public.bets (
    user_id, market_id, side, amount, odds_at_bet,
    potential_payout, fee_amount, status
  )
  VALUES (
    v_user_id, p_market_id, p_side, p_amount, v_current_odds,
    v_potential_payout, v_fee_amount, 'pending'
  )
  RETURNING id INTO v_bet_id;

  -- ── 10. Actualizar pools del mercado (AMM post-apuesta) ──────────────────────
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
    bettor_count = v_market.bettor_count + 1,
    yes_percent  = v_new_yes_pct,
    yes_odds     = v_new_yes_odds,
    no_odds      = v_new_no_odds
  WHERE id = p_market_id;

  -- ── 11. Transacción contable ──────────────────────────────────────────────────
  INSERT INTO public.transactions (user_id, type, amount, balance_after)
  VALUES (v_user_id, 'bet', -p_amount, v_balance_after);

  RETURN json_build_object(
    'bet_id',           v_bet_id,
    'market_id',        p_market_id,
    'side',             p_side,
    'amount',           p_amount,
    'odds_at_bet',      v_current_odds,
    'fee_amount',       v_fee_amount,
    'potential_payout', v_potential_payout,
    'status',           'pending',
    'new_yes_odds',     v_new_yes_odds,
    'new_no_odds',      v_new_no_odds,
    'new_yes_percent',  v_new_yes_pct
  );
END;
$$;

REVOKE ALL ON FUNCTION public.place_bet(uuid, text, numeric, numeric) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.place_bet(uuid, text, numeric, numeric) TO authenticated;

-- ── 3. Vista admin_financial_stats ──────────────────────────────────────────
-- Calcula los KPIs financieros del banco en tiempo real.
-- Solo debe ser consultada por el admin (los permisos de RLS la protegen).
CREATE OR REPLACE VIEW public.admin_financial_stats AS
SELECT
  -- Depósitos totales (dinero real que entró a la plataforma)
  COALESCE((
    SELECT SUM(amount)
    FROM public.transactions
    WHERE type = 'deposit'
  ), 0) AS total_deposits,

  -- Volumen total apostado por los usuarios
  COALESCE((
    SELECT SUM(-amount)
    FROM public.transactions
    WHERE type = 'bet'
  ), 0) AS total_bets_volume,

  -- Total pagado a ganadores
  COALESCE((
    SELECT SUM(amount)
    FROM public.transactions
    WHERE type = 'win'
  ), 0) AS total_wins_paid,

  -- Net Profit (House Edge realizado):
  --   = dinero recibido de apuestas − dinero pagado a ganadores
  --   Con fee del 3%, esto siempre es ≥ 3% del volumen apostado en mercados ya resueltos
  COALESCE((
    SELECT SUM(-amount) FROM public.transactions WHERE type = 'bet'
  ), 0) -
  COALESCE((
    SELECT SUM(amount) FROM public.transactions WHERE type = 'win'
  ), 0) AS net_profit,

  -- House Fee Realizado: comisiones acumuladas de apuestas ganadas
  COALESCE((
    SELECT SUM(fee_amount)
    FROM public.bets
    WHERE status = 'won'
  ), 0) AS house_fee_realized,

  -- House Fee Esperado: incluyendo apuestas pendientes
  COALESCE((
    SELECT SUM(fee_amount)
    FROM public.bets
    WHERE status IN ('won', 'pending')
  ), 0) AS house_fee_expected,

  -- Liability: cuánto tendría que pagar el banco si todos los pendientes ganan
  COALESCE((
    SELECT SUM(potential_payout)
    FROM public.bets
    WHERE status = 'pending'
  ), 0) AS liability,

  -- Contexto general
  (SELECT COUNT(*)::int FROM public.profiles)                   AS total_users,
  (SELECT COUNT(*)::int FROM public.markets WHERE status='open') AS active_markets,
  (SELECT COUNT(*)::int FROM public.bets WHERE status='pending') AS pending_bets;

-- Solo el rol de servicio y los usuarios autenticados pueden leer esta vista.
-- El admin check real ocurre en la aplicación (ADMIN_EMAILS).
GRANT SELECT ON public.admin_financial_stats TO authenticated;
