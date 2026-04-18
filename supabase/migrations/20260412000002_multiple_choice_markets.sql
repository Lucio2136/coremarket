-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Multiple-choice markets (Fase 1)
--
-- 1.  Añade market_type ('binary' | 'multiple') a markets
-- 2.  Añade winning_option_id a markets (para resolver múltiple opción)
-- 3.  Crea tabla market_options (opciones de un mercado de elección múltiple)
-- 4.  Añade option_id a bets (nullable; solo para mercados 'multiple')
-- 5.  Relaja el CHECK de bets.side para permitir NULL en múltiple opción
-- 6.  Actualiza place_bet   — maneja binary Y multiple con un solo RPC
-- 7.  Actualiza resolve_market — acepta p_winning_option_id para múltiple
-- 8.  RLS en market_options (SELECT público, escritura solo admin)
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1: Añadir market_type a markets (winning_option_id se agrega DESPUÉS de crear market_options)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.markets
  ADD COLUMN IF NOT EXISTS market_type text NOT NULL DEFAULT 'binary'
    CHECK (market_type IN ('binary', 'multiple'));


-- ─────────────────────────────────────────────────────────────────────────────
-- 3: Tabla market_options
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.market_options (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id   uuid        NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  label       text        NOT NULL,
  pool        numeric     NOT NULL DEFAULT 0 CHECK (pool >= 0),
  percent     numeric     NOT NULL DEFAULT 0,
  odds        numeric     NOT NULL DEFAULT 2.0,
  sort_order  int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_options_market_id
  ON public.market_options (market_id);

-- Ahora sí agregamos la FK en markets
ALTER TABLE public.markets
  ADD COLUMN IF NOT EXISTS winning_option_id uuid
    REFERENCES public.market_options(id) ON DELETE SET NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4 + 5: bets — añadir option_id y flexibilizar CHECK de side
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.bets
  ADD COLUMN IF NOT EXISTS option_id uuid REFERENCES public.market_options(id) ON DELETE SET NULL;

-- Relajar la restricción de side para permitir NULL cuando hay option_id
DO $$
BEGIN
  ALTER TABLE public.bets DROP CONSTRAINT IF EXISTS bets_side_check;

  ALTER TABLE public.bets
    ADD CONSTRAINT bets_side_check CHECK (
      (option_id IS NULL     AND side IN ('yes', 'no')) OR
      (option_id IS NOT NULL AND side IS NULL)
    );
EXCEPTION WHEN others THEN
  -- Si no existía el constraint simplemente continúa
  NULL;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_bets_option_id ON public.bets (option_id)
  WHERE option_id IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 8: RLS en market_options
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.market_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "market_options_select_public" ON public.market_options;
CREATE POLICY "market_options_select_public"
  ON public.market_options FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "market_options_admin_all" ON public.market_options;
CREATE POLICY "market_options_admin_all"
  ON public.market_options FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid() AND email = 'outfisin@gmail.com'
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 6: place_bet actualizado — binario y múltiple opción
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.place_bet(uuid, text, numeric, numeric);

CREATE OR REPLACE FUNCTION public.place_bet(
  p_market_id uuid,
  p_side      text    DEFAULT NULL,   -- 'yes'|'no' para binary; NULL para multiple
  p_amount    numeric DEFAULT NULL,
  p_odds      numeric DEFAULT NULL,
  p_option_id uuid    DEFAULT NULL    -- solo para multiple-choice
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
  v_option           record;
  v_raw_payout       numeric;
  v_fee_amount       numeric;
  v_potential_payout numeric;
  v_bet_id           uuid;
  v_balance_after    numeric;
  v_current_odds     numeric;
  v_already_bet      boolean;
  v_total_eff        numeric;
  v_option_eff       numeric;
  v_yes_eff          numeric;
  v_no_eff           numeric;
  v_new_yes_pool     numeric;
  v_new_no_pool      numeric;
  v_new_yes_pct      numeric;
  v_new_yes_odds     numeric;
  v_new_no_odds      numeric;
BEGIN

  -- ── 1. Identidad ─────────────────────────────────────────────────────────
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = 'P0001';
  END IF;

  -- ── 2. Validaciones básicas ───────────────────────────────────────────────
  IF p_amount IS NULL OR p_amount < 10 THEN
    RAISE EXCEPTION 'El monto mínimo de apuesta es $10 MXN' USING ERRCODE = 'P0001';
  END IF;
  IF p_odds IS NULL OR p_odds <= 1 THEN
    RAISE EXCEPTION 'Cuota inválida' USING ERRCODE = 'P0001';
  END IF;
  IF p_option_id IS NULL AND p_side NOT IN ('yes', 'no') THEN
    RAISE EXCEPTION 'Lado inválido: debe ser "yes" o "no"' USING ERRCODE = 'P0001';
  END IF;

  -- ── 3. Bloquear y leer mercado ────────────────────────────────────────────
  SELECT id, status, closes_at, yes_pool, no_pool, total_pool, bettor_count, market_type
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
    UPDATE public.markets SET status = 'closed' WHERE id = p_market_id;
    RAISE EXCEPTION 'El mercado ya expiró y no acepta más apuestas' USING ERRCODE = 'P0001';
  END IF;

  -- ── 4. Validar tipo de mercado vs parámetros ─────────────────────────────
  IF v_market.market_type = 'multiple' AND p_option_id IS NULL THEN
    RAISE EXCEPTION 'Se requiere option_id para mercados de opción múltiple' USING ERRCODE = 'P0001';
  END IF;
  IF v_market.market_type = 'binary' AND p_option_id IS NOT NULL THEN
    RAISE EXCEPTION 'Los mercados binarios no usan option_id' USING ERRCODE = 'P0001';
  END IF;

  -- ── 5. ¿Ya apostó este usuario en este mercado? ───────────────────────────
  SELECT EXISTS (
    SELECT 1 FROM public.bets
    WHERE market_id = p_market_id AND user_id = v_user_id
  ) INTO v_already_bet;

  -- ── 6. Calcular odds según tipo ───────────────────────────────────────────
  IF v_market.market_type = 'multiple' THEN

    -- Bloquear la opción seleccionada
    SELECT id, pool
    INTO   v_option
    FROM   public.market_options
    WHERE  id = p_option_id AND market_id = p_market_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Opción no válida para este mercado' USING ERRCODE = 'P0001';
    END IF;

    -- total_eff = suma de (pool_i + k_virtual) para todas las opciones del mercado
    SELECT COALESCE(SUM(pool + k_virtual), k_virtual)
    INTO   v_total_eff
    FROM   public.market_options
    WHERE  market_id = p_market_id;

    v_option_eff   := v_option.pool + k_virtual;
    v_current_odds := ROUND(v_total_eff / v_option_eff, 4);

  ELSE
    -- BINARY: lógica AMM original
    v_yes_eff      := COALESCE(v_market.yes_pool, 0) + k_virtual;
    v_no_eff       := COALESCE(v_market.no_pool,  0) + k_virtual;
    v_total_eff    := v_yes_eff + v_no_eff;

    IF p_side = 'yes' THEN
      v_current_odds := ROUND(v_total_eff / v_yes_eff, 4);
    ELSE
      v_current_odds := ROUND(v_total_eff / v_no_eff, 4);
    END IF;
  END IF;

  -- ── 7. Slippage ±10% ──────────────────────────────────────────────────────
  IF ABS(p_odds - v_current_odds) / v_current_odds > 0.10 THEN
    RAISE EXCEPTION
      'Las cuotas han cambiado (%.2f → %.2f). Recarga y vuelve a intentarlo.',
      p_odds, v_current_odds
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 8. Saldo del usuario ──────────────────────────────────────────────────
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

  -- ── 9. Calcular pago con fee ──────────────────────────────────────────────
  v_raw_payout       := ROUND(p_amount * v_current_odds, 2);
  v_fee_amount       := ROUND(v_raw_payout * k_fee_rate, 2);
  v_potential_payout := v_raw_payout - v_fee_amount;
  v_balance_after    := v_balance - p_amount;

  -- ── 10. Descontar saldo ───────────────────────────────────────────────────
  UPDATE public.profiles
  SET    balance_mxn = v_balance_after,
         total_bet   = COALESCE(total_bet, 0) + p_amount
  WHERE  id = v_user_id;

  -- ── 11. Insertar apuesta ──────────────────────────────────────────────────
  INSERT INTO public.bets (
    user_id, market_id, option_id, side, amount, odds_at_bet,
    potential_payout, fee_amount, status
  )
  VALUES (
    v_user_id, p_market_id,
    p_option_id,                                          -- NULL para binary
    CASE WHEN p_option_id IS NULL THEN p_side ELSE NULL END,
    p_amount, v_current_odds,
    v_potential_payout, v_fee_amount, 'pending'
  )
  RETURNING id INTO v_bet_id;

  -- ── 12. Actualizar pools del mercado ─────────────────────────────────────
  IF v_market.market_type = 'multiple' THEN

    -- a) Sumar apuesta al pool de la opción elegida
    UPDATE public.market_options
    SET pool = pool + p_amount
    WHERE id = p_option_id;

    -- b) Recalcular percent y odds de TODAS las opciones (con nuevos pools)
    UPDATE public.market_options mo
    SET
      percent = ROUND(
        (mo.pool + k_virtual)
        / (SELECT SUM(pool + k_virtual) FROM public.market_options WHERE market_id = p_market_id)
        * 100, 1
      ),
      odds = GREATEST(1.01, ROUND(
        (SELECT SUM(pool + k_virtual) FROM public.market_options WHERE market_id = p_market_id)
        / (mo.pool + k_virtual), 2
      ))
    WHERE mo.market_id = p_market_id;

    -- c) Actualizar totales del mercado (sin yes_pool/no_pool)
    UPDATE public.markets
    SET
      total_pool   = total_pool + p_amount,
      bettor_count = bettor_count + CASE WHEN v_already_bet THEN 0 ELSE 1 END
    WHERE id = p_market_id;

  ELSE
    -- BINARY: AMM post-apuesta
    IF p_side = 'yes' THEN
      v_new_yes_pool := COALESCE(v_market.yes_pool, 0) + p_amount;
      v_new_no_pool  := COALESCE(v_market.no_pool,  0);
    ELSE
      v_new_yes_pool := COALESCE(v_market.yes_pool, 0);
      v_new_no_pool  := COALESCE(v_market.no_pool,  0) + p_amount;
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
      total_pool   = total_pool + p_amount,
      bettor_count = bettor_count + CASE WHEN v_already_bet THEN 0 ELSE 1 END,
      yes_percent  = v_new_yes_pct,
      yes_odds     = v_new_yes_odds,
      no_odds      = v_new_no_odds
    WHERE id = p_market_id;
  END IF;

  -- ── 13. Transacción contable ──────────────────────────────────────────────
  INSERT INTO public.transactions (user_id, type, amount, balance_after)
  VALUES (v_user_id, 'bet', -p_amount, v_balance_after);

  RETURN json_build_object(
    'bet_id',           v_bet_id,
    'market_id',        p_market_id,
    'side',             p_side,
    'option_id',        p_option_id,
    'amount',           p_amount,
    'odds_at_bet',      v_current_odds,
    'fee_amount',       v_fee_amount,
    'potential_payout', v_potential_payout,
    'status',           'pending'
  );
END;
$$;

REVOKE ALL    ON FUNCTION public.place_bet(uuid, text, numeric, numeric, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.place_bet(uuid, text, numeric, numeric, uuid) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7: resolve_market actualizado — binario y múltiple opción
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.resolve_market(uuid, text);

CREATE OR REPLACE FUNCTION public.resolve_market(
  p_market_id          uuid,
  p_winning_side       text DEFAULT NULL,   -- 'yes'|'no' para binary
  p_winning_option_id  uuid DEFAULT NULL    -- uuid  para multiple
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
  v_market_type   text;
  v_bet           record;
  v_balance_after numeric;
  v_winners_paid  int     := 0;
  v_total_payout  numeric := 0;
  v_option_label  text;
BEGIN

  -- ── 1. Autenticación + admin ──────────────────────────────────────────────
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = 'P0001';
  END IF;

  SELECT email INTO v_caller_email
  FROM   auth.users WHERE id = v_caller_id;

  IF v_caller_email NOT IN ('outfisin@gmail.com') THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere rol de administrador'
      USING ERRCODE = 'P0003';
  END IF;

  -- ── 2. Validar parámetros ─────────────────────────────────────────────────
  IF p_winning_side IS NULL AND p_winning_option_id IS NULL THEN
    RAISE EXCEPTION 'Debes especificar p_winning_side o p_winning_option_id'
      USING ERRCODE = 'P0001';
  END IF;
  IF p_winning_side IS NOT NULL AND p_winning_side NOT IN ('yes', 'no') THEN
    RAISE EXCEPTION 'Lado ganador inválido: debe ser "yes" o "no"'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 3. Bloquear mercado ───────────────────────────────────────────────────
  SELECT status, market_type
  INTO   v_market_status, v_market_type
  FROM   public.markets
  WHERE  id = p_market_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mercado no encontrado' USING ERRCODE = 'P0001';
  END IF;
  IF v_market_status <> 'open' THEN
    RAISE EXCEPTION 'El mercado ya está cerrado' USING ERRCODE = 'P0001';
  END IF;

  -- ── 4. Validar tipo de mercado vs parámetros ──────────────────────────────
  IF v_market_type = 'binary' AND p_winning_side IS NULL THEN
    RAISE EXCEPTION 'Los mercados binarios requieren p_winning_side'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_market_type = 'multiple' AND p_winning_option_id IS NULL THEN
    RAISE EXCEPTION 'Los mercados de opción múltiple requieren p_winning_option_id'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 5. Verificar que la opción pertenece al mercado (solo multiple) ────────
  IF v_market_type = 'multiple' THEN
    SELECT label INTO v_option_label
    FROM   public.market_options
    WHERE  id = p_winning_option_id AND market_id = p_market_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'La opción no pertenece a este mercado' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- ── 6. Cerrar mercado y registrar resultado ───────────────────────────────
  UPDATE public.markets
  SET
    status            = 'closed',
    result            = CASE WHEN v_market_type = 'binary' THEN p_winning_side ELSE NULL END,
    winning_option_id = CASE WHEN v_market_type = 'multiple' THEN p_winning_option_id ELSE NULL END
  WHERE id = p_market_id;

  -- ── 7. Marcar apuestas perdedoras ─────────────────────────────────────────
  IF v_market_type = 'binary' THEN
    UPDATE public.bets
    SET    status = 'lost'
    WHERE  market_id = p_market_id
      AND  side      <> p_winning_side
      AND  status    = 'pending';
  ELSE
    UPDATE public.bets
    SET    status = 'lost'
    WHERE  market_id  = p_market_id
      AND  option_id  <> p_winning_option_id
      AND  status     = 'pending';
  END IF;

  -- ── 8. Pagar apuestas ganadoras ───────────────────────────────────────────
  FOR v_bet IN
    SELECT b.id, b.user_id, b.potential_payout
    FROM   public.bets b
    WHERE  b.market_id = p_market_id
      AND  b.status    = 'pending'
      AND  (
        (v_market_type = 'binary'   AND b.side      = p_winning_side)      OR
        (v_market_type = 'multiple' AND b.option_id = p_winning_option_id)
      )
    ORDER BY b.user_id
    FOR UPDATE
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

  -- ── 9. Resumen ────────────────────────────────────────────────────────────
  RETURN json_build_object(
    'market_id',          p_market_id,
    'market_type',        v_market_type,
    'result',             COALESCE(p_winning_side, v_option_label),
    'winning_option_id',  p_winning_option_id,
    'winners_paid',       v_winners_paid,
    'total_payout',       v_total_payout
  );
END;
$$;

REVOKE ALL    ON FUNCTION public.resolve_market(uuid, text, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.resolve_market(uuid, text, uuid) TO authenticated;
