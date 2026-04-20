-- ═══════════════════════════════════════════════════════════════════════════
-- Fix 1: Códigos de referido aleatorios
--
-- Reemplaza el patrón predecible (primeros 8 hex del UUID) por 8 caracteres
-- aleatorios en base58 → ~47 bits de entropía, sin caracteres ambiguos.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_code  TEXT;
  v_chars TEXT  := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  v_bytes BYTEA;
  i       INT;
BEGIN
  IF NEW.referral_code IS NULL THEN
    LOOP
      v_code  := '';
      v_bytes := gen_random_bytes(8);
      FOR i IN 0..7 LOOP
        v_code := v_code || SUBSTR(v_chars, (get_byte(v_bytes, i) % length(v_chars)) + 1, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE referral_code = v_code
      );
    END LOOP;
    NEW.referral_code := v_code;
  END IF;
  RETURN NEW;
END;
$$;

-- Regenerar códigos existentes que siguen el patrón antiguo [0-9A-F]{8}
DO $$
DECLARE
  rec     RECORD;
  v_code  TEXT;
  v_chars TEXT  := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  v_bytes BYTEA;
  i       INT;
BEGIN
  FOR rec IN
    SELECT id FROM public.profiles
    WHERE referral_code ~ '^[0-9A-F]{8}$'
  LOOP
    LOOP
      v_code  := '';
      v_bytes := gen_random_bytes(8);
      FOR i IN 0..7 LOOP
        v_code := v_code || SUBSTR(v_chars, (get_byte(v_bytes, i) % length(v_chars)) + 1, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE referral_code = v_code
      );
    END LOOP;
    UPDATE public.profiles SET referral_code = v_code WHERE id = rec.id;
  END LOOP;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- Fix 2: Rate limiting por usuario
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.rate_limits (
  user_id       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action        text        NOT NULL,
  window_start  timestamptz NOT NULL,
  request_count int         NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, action, window_start)
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
  ON public.rate_limits (user_id, action, window_start);

-- ── RPC: check_rate_limit ─────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.check_rate_limit(uuid, text, int, int);

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id     uuid,
  p_action      text,
  p_window_secs int,
  p_max_count   int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_window timestamptz;
  v_count  int;
BEGIN
  v_window := to_timestamp(
    (EXTRACT(EPOCH FROM now())::bigint / p_window_secs) * p_window_secs
  );

  DELETE FROM public.rate_limits
  WHERE user_id     = p_user_id
    AND action      = p_action
    AND window_start < v_window;

  INSERT INTO public.rate_limits (user_id, action, window_start, request_count)
  VALUES (p_user_id, p_action, v_window, 1)
  ON CONFLICT (user_id, action, window_start)
  DO UPDATE SET request_count = public.rate_limits.request_count + 1
  RETURNING request_count INTO v_count;

  IF v_count > p_max_count THEN
    RAISE EXCEPTION 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.'
      USING ERRCODE = 'P0429';
  END IF;
END;
$$;

REVOKE ALL    ON FUNCTION public.check_rate_limit(uuid, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, int, int) TO authenticated;


-- ── Integrar rate limit en place_bet (30 apuestas/minuto por usuario) ─────────

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
  v_mkt_id           uuid;
  v_mkt_status       text;
  v_mkt_closes_at    timestamptz;
  v_mkt_yes_pool     numeric;
  v_mkt_no_pool      numeric;
  v_mkt_total_pool   numeric;
  v_mkt_bettor_count int;
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

  -- ── 1. Identidad ─────────────────────────────────────────────────────────
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = 'P0001';
  END IF;

  -- ── 2. Rate limit: 30 apuestas por minuto ────────────────────────────────
  PERFORM public.check_rate_limit(v_user_id, 'bet', 60, 30);

  -- ── 3. Validaciones básicas ───────────────────────────────────────────────
  IF p_amount < 10 THEN
    RAISE EXCEPTION 'El monto mínimo de apuesta es $10 MXN' USING ERRCODE = 'P0001';
  END IF;
  IF p_side NOT IN ('yes', 'no') THEN
    RAISE EXCEPTION 'Lado inválido: debe ser "yes" o "no"' USING ERRCODE = 'P0001';
  END IF;
  IF p_odds <= 1 THEN
    RAISE EXCEPTION 'Cuota inválida' USING ERRCODE = 'P0001';
  END IF;

  -- ── 4. Bloquear y leer mercado ────────────────────────────────────────────
  SELECT id, status, closes_at, yes_pool, no_pool, total_pool, bettor_count
  INTO   v_mkt_id, v_mkt_status, v_mkt_closes_at,
         v_mkt_yes_pool, v_mkt_no_pool, v_mkt_total_pool, v_mkt_bettor_count
  FROM   public.markets
  WHERE  id = p_market_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mercado no encontrado' USING ERRCODE = 'P0001';
  END IF;
  IF v_mkt_status <> 'open' THEN
    RAISE EXCEPTION 'El mercado está cerrado' USING ERRCODE = 'P0001';
  END IF;
  IF v_mkt_closes_at IS NOT NULL AND v_mkt_closes_at < NOW() THEN
    UPDATE public.markets SET status = 'closed' WHERE id = p_market_id;
    RAISE EXCEPTION 'El mercado ya expiró y no acepta más apuestas' USING ERRCODE = 'P0001';
  END IF;

  -- ── 5. ¿Ya apostó este usuario? (dedup bettor_count) ─────────────────────
  SELECT EXISTS (
    SELECT 1 FROM public.bets
    WHERE market_id = p_market_id AND user_id = v_user_id
  ) INTO v_already_bet;

  -- ── 6. Calcular odds actuales (AMM pre-apuesta) ───────────────────────────
  v_yes_eff   := v_mkt_yes_pool + k_virtual;
  v_no_eff    := v_mkt_no_pool  + k_virtual;
  v_total_eff := v_yes_eff + v_no_eff;

  IF p_side = 'yes' THEN
    v_current_odds := ROUND(v_total_eff / v_yes_eff, 4);
  ELSE
    v_current_odds := ROUND(v_total_eff / v_no_eff, 4);
  END IF;

  -- ── 7. Slippage ±10% ──────────────────────────────────────────────────────
  IF ABS(p_odds - v_current_odds) / v_current_odds > 0.10 THEN
    RAISE EXCEPTION
      'Las cuotas han cambiado (%.2f → %.2f). Recarga y vuelve a intentarlo.',
      p_odds, v_current_odds
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 8. Saldo del usuario ──────────────────────────────────────────────────
  SELECT balance_mxn INTO v_balance
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

  -- ── 9. Calcular pago con fee de la casa ───────────────────────────────────
  v_raw_payout       := ROUND(p_amount * v_current_odds, 2);
  v_fee_amount       := ROUND(v_raw_payout * k_fee_rate, 2);
  v_potential_payout := v_raw_payout - v_fee_amount;
  v_balance_after    := v_balance - p_amount;

  -- ── 10. Descontar saldo ───────────────────────────────────────────────────
  UPDATE public.profiles
  SET    balance_mxn = v_balance_after,
         total_bet   = COALESCE(total_bet, 0) + p_amount
  WHERE  id = v_user_id;

  -- ── 11. Insertar la apuesta ───────────────────────────────────────────────
  INSERT INTO public.bets (
    user_id, market_id, side, amount, odds_at_bet,
    potential_payout, fee_amount, status
  )
  VALUES (
    v_user_id, p_market_id, p_side, p_amount, v_current_odds,
    v_potential_payout, v_fee_amount, 'pending'
  )
  RETURNING id INTO v_bet_id;

  -- ── 12. Actualizar pools del mercado (AMM post-apuesta) ───────────────────
  IF p_side = 'yes' THEN
    v_new_yes_pool := v_mkt_yes_pool + p_amount;
    v_new_no_pool  := v_mkt_no_pool;
  ELSE
    v_new_yes_pool := v_mkt_yes_pool;
    v_new_no_pool  := v_mkt_no_pool + p_amount;
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
    total_pool   = v_mkt_total_pool + p_amount,
    bettor_count = v_mkt_bettor_count + CASE WHEN v_already_bet THEN 0 ELSE 1 END,
    yes_percent  = v_new_yes_pct,
    yes_odds     = v_new_yes_odds,
    no_odds      = v_new_no_odds
  WHERE id = p_market_id;

  -- ── 13. Transacción contable ──────────────────────────────────────────────
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
