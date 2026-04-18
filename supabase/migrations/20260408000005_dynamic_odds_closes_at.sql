-- ============================================================
-- Migration 005: Cuotas dinámicas (AMM) + cierre automático por closes_at
--
-- Cambios:
--   1. ALTER markets: agrega yes_pool / no_pool para rastrear el pool
--      por lado sin hacer SUM() en cada apuesta.
--   2. Nueva place_bet:
--      • Rechaza si closes_at ya pasó (cierre automático).
--      • Protección de slippage ±10%: si las cuotas enviadas por el
--        cliente difieren >10% de las reales, se rechaza la apuesta.
--      • Actualiza yes_pool / no_pool, recalcula odds con fórmula AMM
--        (liquidez virtual k=200 MXN por lado para que arranquen en 50/50).
--      • Mantiene total_bet en profiles (del fix 004).
-- ============================================================

-- ── 1. Columnas de pool por lado ─────────────────────────────────────────────
ALTER TABLE public.markets
  ADD COLUMN IF NOT EXISTS yes_pool numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS no_pool  numeric NOT NULL DEFAULT 0;

-- Rellenar desde apuestas existentes
UPDATE public.markets m
SET
  yes_pool = COALESCE((
    SELECT SUM(amount) FROM public.bets
    WHERE market_id = m.id AND side = 'yes'
  ), 0),
  no_pool = COALESCE((
    SELECT SUM(amount) FROM public.bets
    WHERE market_id = m.id AND side = 'no'
  ), 0);

-- ── 2. Nueva place_bet ────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.place_bet(uuid, text, numeric, numeric);

CREATE OR REPLACE FUNCTION public.place_bet(
  p_market_id uuid,
  p_side      text,
  p_amount    numeric,
  p_odds      numeric         -- cuota mostrada al usuario (para slippage check)
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- Liquidez virtual por lado: evita odds infinitas cuando el pool está vacío
  -- y hace que el mercado arranque en 50 % / 2.00x en ambos lados.
  k_virtual       CONSTANT numeric := 200;

  v_user_id          uuid;
  v_balance          numeric;
  v_market           record;
  v_potential_payout numeric;
  v_bet_id           uuid;
  v_balance_after    numeric;

  -- Variables AMM
  v_new_yes_pool  numeric;
  v_new_no_pool   numeric;
  v_yes_eff       numeric;
  v_no_eff        numeric;
  v_total_eff     numeric;
  v_new_yes_pct   numeric;
  v_new_yes_odds  numeric;
  v_new_no_odds   numeric;
  v_current_odds  numeric;
BEGIN

  -- ── 1. Identidad ────────────────────────────────────────────────────────────
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = 'P0001';
  END IF;

  -- ── 2. Validaciones básicas ──────────────────────────────────────────────────
  IF p_amount < 10 THEN
    RAISE EXCEPTION 'El monto mínimo de apuesta es $10 MXN' USING ERRCODE = 'P0001';
  END IF;

  IF p_side NOT IN ('yes', 'no') THEN
    RAISE EXCEPTION 'Lado inválido: debe ser "yes" o "no"' USING ERRCODE = 'P0001';
  END IF;

  IF p_odds <= 1 THEN
    RAISE EXCEPTION 'Cuota inválida' USING ERRCODE = 'P0001';
  END IF;

  -- ── 3. Leer y bloquear el mercado ───────────────────────────────────────────
  SELECT id, status, closes_at, yes_pool, no_pool, total_pool, bettor_count
  INTO   v_market
  FROM   public.markets
  WHERE  id = p_market_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mercado no encontrado' USING ERRCODE = 'P0001';
  END IF;

  -- Cierre explícito por admin
  IF v_market.status <> 'open' THEN
    RAISE EXCEPTION 'El mercado está cerrado' USING ERRCODE = 'P0001';
  END IF;

  -- Cierre automático por closes_at (aunque el admin no haya actuado)
  IF v_market.closes_at IS NOT NULL AND v_market.closes_at < NOW() THEN
    RAISE EXCEPTION 'El mercado ya expiró y no acepta más apuestas'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 4. Calcular odds actuales del lado elegido (pre-apuesta) ────────────────
  --   Usamos la fórmula AMM con liquidez virtual para tener el precio actual.
  v_yes_eff      := v_market.yes_pool + k_virtual;
  v_no_eff       := v_market.no_pool  + k_virtual;
  v_total_eff    := v_yes_eff + v_no_eff;

  IF p_side = 'yes' THEN
    v_current_odds := ROUND(v_total_eff / v_yes_eff, 4);
  ELSE
    v_current_odds := ROUND(v_total_eff / v_no_eff, 4);
  END IF;

  -- ── 5. Protección de slippage ±10% ──────────────────────────────────────────
  --   Si el cliente envía unas cuotas que ya no reflejan el estado real del
  --   mercado (alguien apostó antes y movió el precio), se rechaza la apuesta
  --   para proteger al usuario de recibir un pago menor al esperado.
  IF ABS(p_odds - v_current_odds) / v_current_odds > 0.10 THEN
    RAISE EXCEPTION
      'Las cuotas han cambiado (%.2f → %.2f). Recarga y vuelve a intentarlo.',
      p_odds, v_current_odds
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 6. Saldo del usuario (lock anti-race-condition) ──────────────────────────
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

  -- ── 7. Calcular pago potencial con las cuotas actuales (server-side) ─────────
  --   Usamos v_current_odds (calculada en el servidor) para que el payout sea
  --   siempre correcto y no manipulable desde el cliente.
  v_potential_payout := ROUND(p_amount * v_current_odds, 2);
  v_balance_after    := v_balance - p_amount;

  -- ── 8. Descontar saldo y actualizar total_bet ────────────────────────────────
  UPDATE public.profiles
  SET    balance_mxn = v_balance_after,
         total_bet   = COALESCE(total_bet, 0) + p_amount
  WHERE  id = v_user_id;

  -- ── 9. Insertar la apuesta ───────────────────────────────────────────────────
  INSERT INTO public.bets (
    user_id, market_id, side, amount, odds_at_bet, potential_payout, status
  )
  VALUES (
    v_user_id, p_market_id, p_side,
    p_amount, v_current_odds, v_potential_payout, 'pending'
  )
  RETURNING id INTO v_bet_id;

  -- ── 10. Actualizar pools del mercado ─────────────────────────────────────────
  IF p_side = 'yes' THEN
    v_new_yes_pool := v_market.yes_pool + p_amount;
    v_new_no_pool  := v_market.no_pool;
  ELSE
    v_new_yes_pool := v_market.yes_pool;
    v_new_no_pool  := v_market.no_pool + p_amount;
  END IF;

  -- ── 11. Recalcular odds con AMM (post-apuesta) ───────────────────────────────
  v_yes_eff   := v_new_yes_pool + k_virtual;
  v_no_eff    := v_new_no_pool  + k_virtual;
  v_total_eff := v_yes_eff + v_no_eff;

  v_new_yes_pct  := ROUND(v_yes_eff / v_total_eff * 100, 1);
  -- Cuota mínima 1.01 para evitar valores absurdos si un lado tiene todo el pool
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

  -- ── 12. Transacción contable ──────────────────────────────────────────────────
  INSERT INTO public.transactions (user_id, type, amount, balance_after)
  VALUES (v_user_id, 'bet', -p_amount, v_balance_after);

  -- ── 13. Resultado ────────────────────────────────────────────────────────────
  RETURN json_build_object(
    'bet_id',           v_bet_id,
    'market_id',        p_market_id,
    'side',             p_side,
    'amount',           p_amount,
    'odds_at_bet',      v_current_odds,
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

COMMENT ON FUNCTION public.place_bet IS
  'AMM v2: calcula odds server-side con liquidez virtual k=200, '
  'protege contra slippage >10%, rechaza mercados expirados por closes_at, '
  'y actualiza yes_pool/no_pool/yes_odds/no_odds en markets atómicamente.';
