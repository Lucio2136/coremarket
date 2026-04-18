-- ============================================================
-- Fix: place_bet y resolve_market deben actualizar total_bet / total_won
-- en profiles para que el panel admin muestre los datos correctos.
-- ============================================================

-- ── place_bet ────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.place_bet(uuid, text, numeric, numeric);

CREATE OR REPLACE FUNCTION public.place_bet(
  p_market_id      uuid,
  p_side           text,
  p_amount         numeric,
  p_odds           numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id          uuid;
  v_balance          numeric;
  v_market_status    text;
  v_potential_payout numeric;
  v_bet_id           uuid;
  v_balance_after    numeric;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = 'P0001';
  END IF;

  IF p_amount < 10 THEN
    RAISE EXCEPTION 'El monto mínimo de apuesta es $10 MXN' USING ERRCODE = 'P0001';
  END IF;

  IF p_side NOT IN ('yes', 'no') THEN
    RAISE EXCEPTION 'Lado inválido: debe ser "yes" o "no"' USING ERRCODE = 'P0001';
  END IF;

  IF p_odds <= 0 THEN
    RAISE EXCEPTION 'Cuota inválida' USING ERRCODE = 'P0001';
  END IF;

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

  v_potential_payout := p_amount * p_odds;
  v_balance_after    := v_balance - p_amount;

  -- FIX: también incrementa total_bet
  UPDATE public.profiles
  SET    balance_mxn = v_balance_after,
         total_bet   = COALESCE(total_bet, 0) + p_amount
  WHERE  id = v_user_id;

  INSERT INTO public.bets (
    user_id, market_id, side, amount, odds_at_bet, potential_payout, status
  )
  VALUES (
    v_user_id, p_market_id, p_side, p_amount, p_odds, v_potential_payout, 'pending'
  )
  RETURNING id INTO v_bet_id;

  INSERT INTO public.transactions (user_id, type, amount, balance_after)
  VALUES (v_user_id, 'bet', -p_amount, v_balance_after);

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

REVOKE ALL ON FUNCTION public.place_bet(uuid, text, numeric, numeric) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.place_bet(uuid, text, numeric, numeric) TO authenticated;


-- ── resolve_market ───────────────────────────────────────────────────────────
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

  SELECT email
  INTO   v_caller_email
  FROM   auth.users
  WHERE  id = v_caller_id;

  IF v_caller_email NOT IN ('outfisin@gmail.com') THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere rol de administrador'
      USING ERRCODE = 'P0003';
  END IF;

  IF p_winning_side NOT IN ('yes', 'no') THEN
    RAISE EXCEPTION 'Lado ganador inválido: debe ser "yes" o "no"'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT status
  INTO   v_market_status
  FROM   public.markets
  WHERE  id = p_market_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mercado no encontrado' USING ERRCODE = 'P0001';
  END IF;

  IF v_market_status <> 'open' THEN
    RAISE EXCEPTION 'El mercado ya está cerrado' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.markets
  SET    status = 'closed',
         result = p_winning_side
  WHERE  id = p_market_id;

  UPDATE public.bets
  SET    status = 'lost'
  WHERE  market_id = p_market_id
    AND  side      <> p_winning_side
    AND  status    = 'pending';

  FOR v_bet IN
    SELECT b.id, b.user_id, b.potential_payout
    FROM   public.bets b
    WHERE  b.market_id = p_market_id
      AND  b.side      = p_winning_side
      AND  b.status    = 'pending'
    ORDER  BY b.user_id
    FOR UPDATE
  LOOP
    -- FIX: también incrementa total_won
    UPDATE public.profiles
    SET    balance_mxn = balance_mxn + v_bet.potential_payout,
           total_won   = COALESCE(total_won, 0) + v_bet.potential_payout
    WHERE  id = v_bet.user_id
    RETURNING balance_mxn INTO v_balance_after;

    UPDATE public.bets
    SET    status = 'won'
    WHERE  id = v_bet.id;

    INSERT INTO public.transactions (user_id, type, amount, balance_after)
    VALUES (v_bet.user_id, 'win', v_bet.potential_payout, v_balance_after);

    v_winners_paid := v_winners_paid + 1;
    v_total_payout := v_total_payout + v_bet.potential_payout;
  END LOOP;

  RETURN json_build_object(
    'market_id',    p_market_id,
    'result',       p_winning_side,
    'winners_paid', v_winners_paid,
    'total_payout', v_total_payout
  );
END;
$$;

REVOKE ALL  ON FUNCTION public.resolve_market(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_market(uuid, text) TO authenticated;
