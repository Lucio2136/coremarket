-- ============================================================
-- Eliminar versión anterior (firma con p_user_id que el cliente controlaba)
DROP FUNCTION IF EXISTS public.place_bet(uuid, uuid, text, numeric);

-- ============================================================
-- RPC: place_bet
-- Motor de apuestas atómico y seguro.
--
-- Reglas aplicadas:
--   • security-rls-basics   → auth.uid() como fuente de verdad del usuario
--   • security-rls-perf     → SECURITY DEFINER + SET search_path = ''
--   • lock-deadlock-prev    → SELECT ... FOR UPDATE en profiles antes
--                             de cualquier escritura
--   • lock-short-txns       → toda la lógica en un único bloque plpgsql,
--                             sin ida y vuelta al cliente entre locks
-- ============================================================

CREATE OR REPLACE FUNCTION public.place_bet(
  p_market_id      uuid,
  p_side           text,
  p_amount         numeric,
  p_odds           numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''            -- evita search_path hijacking
AS $$
DECLARE
  v_user_id          uuid;
  v_balance          numeric;
  v_market_status    text;
  v_potential_payout numeric;
  v_bet_id           uuid;
  v_balance_after    numeric;
BEGIN
  -- ── 1. Identidad del usuario ─────────────────────────────────────────────
  --   Usamos auth.uid() directo, NUNCA confiamos en un p_user_id del cliente.
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = 'P0001';
  END IF;

  -- ── 2. Validaciones de entrada ───────────────────────────────────────────
  IF p_amount < 10 THEN
    RAISE EXCEPTION 'El monto mínimo de apuesta es $10 MXN' USING ERRCODE = 'P0001';
  END IF;

  IF p_side NOT IN ('yes', 'no') THEN
    RAISE EXCEPTION 'Lado inválido: debe ser "yes" o "no"' USING ERRCODE = 'P0001';
  END IF;

  IF p_odds <= 0 THEN
    RAISE EXCEPTION 'Cuota inválida' USING ERRCODE = 'P0001';
  END IF;

  -- ── 3. Verificar que el mercado está abierto (lectura rápida, sin lock) ──
  SELECT status
  INTO   v_market_status
  FROM   public.markets
  WHERE  id = p_market_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mercado no encontrado' USING ERRCODE = 'P0001';
  END IF;

  IF v_market_status <> 'open' THEN
    RAISE EXCEPTION 'El mercado está cerrado' USING ERRCODE = 'P0001';
  END IF;

  -- ── 4. Bloquear la fila del perfil ANTES de leer el saldo ────────────────
  --   SELECT ... FOR UPDATE garantiza que dos apuestas concurrentes del
  --   mismo usuario se serialicen aquí, eliminando la race condition de
  --   read-modify-write del cliente.
  --   (skill: lock-deadlock-prevention — adquirir lock explícito y
  --   consistente antes de cualquier UPDATE)
  SELECT balance_mxn
  INTO   v_balance
  FROM   public.profiles
  WHERE  id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil no encontrado' USING ERRCODE = 'P0001';
  END IF;

  -- ── 5. Verificar saldo suficiente ────────────────────────────────────────
  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente. Saldo actual: $% MXN', round(v_balance, 2)
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 6. Calcular pago potencial y saldo resultante ───────────────────────
  v_potential_payout := p_amount * p_odds;
  v_balance_after    := v_balance - p_amount;

  -- ── 7. Descontar saldo (UPDATE atómico — el lock ya está tomado) ─────────
  UPDATE public.profiles
  SET    balance_mxn = v_balance_after
  WHERE  id = v_user_id;

  -- ── 8. Insertar la apuesta ───────────────────────────────────────────────
  INSERT INTO public.bets (
    user_id, market_id, side, amount, odds_at_bet, potential_payout, status
  )
  VALUES (
    v_user_id, p_market_id, p_side, p_amount, p_odds, v_potential_payout, 'pending'
  )
  RETURNING id INTO v_bet_id;

  -- ── 9. Registrar la transacción ──────────────────────────────────────────
  INSERT INTO public.transactions (user_id, type, amount, balance_after)
  VALUES (v_user_id, 'bet', -p_amount, v_balance_after);

  -- ── 10. Devolver el resultado ────────────────────────────────────────────
  RETURN json_build_object(
    'bet_id',           v_bet_id,
    'market_id',        p_market_id,
    'side',             p_side,
    'amount',           p_amount,
    'odds_at_bet',      p_odds,
    'potential_payout', v_potential_payout,
    'status',           'pending'
  );
END;
$$;

-- Revocar acceso público por defecto y otorgar solo a usuarios autenticados
REVOKE ALL ON FUNCTION public.place_bet(uuid, text, numeric, numeric) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.place_bet(uuid, text, numeric, numeric) TO authenticated;

COMMENT ON FUNCTION public.place_bet IS
  'Motor de apuestas atómico. Verifica saldo, descuenta, inserta apuesta y '
  'transacción en una sola transacción. El usuario es auth.uid(), nunca un '
  'parámetro del cliente.';
