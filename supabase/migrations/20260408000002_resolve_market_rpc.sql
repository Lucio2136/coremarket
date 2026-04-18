-- ============================================================
-- RPC: resolve_market
-- Cierra un mercado, paga a ganadores y marca perdedores.
--
-- Prácticas aplicadas:
--   • security-rls-basics    → auth.uid() como identidad; admin verificado
--                              contra auth.users (nunca parámetro del cliente)
--   • security-rls-perf      → SECURITY DEFINER + SET search_path = ''
--   • lock-deadlock-prev     → bets bloqueados con FOR UPDATE ORDER BY user_id
--                              (orden consistente = sin deadlock entre calls)
--   • lock-short-txns        → toda la lógica en un bloque atómico único;
--                              sin roundtrips al cliente entre locks
--   • idempotencia           → verifica status = 'open' antes de actuar;
--                              second call falla limpiamente con excepción
-- ============================================================

DROP FUNCTION IF EXISTS public.resolve_market(uuid, text);

CREATE OR REPLACE FUNCTION public.resolve_market(
  p_market_id    uuid,
  p_winning_side text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''          -- evita search_path hijacking
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
  -- ── 1. Identidad del llamador ────────────────────────────────────────────
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = 'P0001';
  END IF;

  -- ── 2. Verificar rol de administrador ───────────────────────────────────
  --   Se consulta auth.users (fuente de verdad), nunca un parámetro externo.
  SELECT email
  INTO   v_caller_email
  FROM   auth.users
  WHERE  id = v_caller_id;

  IF v_caller_email NOT IN ('outfisin@gmail.com') THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere rol de administrador'
      USING ERRCODE = 'P0003';
  END IF;

  -- ── 3. Validar parámetro winning_side ───────────────────────────────────
  IF p_winning_side NOT IN ('yes', 'no') THEN
    RAISE EXCEPTION 'Lado ganador inválido: debe ser "yes" o "no"'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 4. Bloquear el mercado y verificar que está abierto ─────────────────
  --   FOR UPDATE en markets evita que dos resoluciones corran en paralelo
  --   sobre el mismo mercado. La segunda caerá en el IF de status <> 'open'.
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

  -- ── 5. Cerrar el mercado y registrar el resultado ────────────────────────
  UPDATE public.markets
  SET    status = 'closed',
         result = p_winning_side
  WHERE  id = p_market_id;

  -- ── 6. Marcar apuestas perdedoras (sin lock de perfil, sin pago) ─────────
  UPDATE public.bets
  SET    status = 'lost'
  WHERE  market_id = p_market_id
    AND  side      <> p_winning_side
    AND  status    = 'pending';

  -- ── 7. Procesar apuestas ganadoras ──────────────────────────────────────
  --   ORDER BY user_id en el FOR UPDATE es clave: garantiza que dos llamadas
  --   concurrentes a resolve_market (mercados distintos) adquieran locks de
  --   perfil en el mismo orden global → sin deadlock.
  FOR v_bet IN
    SELECT b.id, b.user_id, b.potential_payout
    FROM   public.bets b
    WHERE  b.market_id = p_market_id
      AND  b.side      = p_winning_side
      AND  b.status    = 'pending'
    ORDER  BY b.user_id          -- orden consistente anti-deadlock
    FOR UPDATE                   -- bloquea filas de bets durante el procesado
  LOOP
    -- 7a. Acreditar saldo al ganador (UPDATE adquiere lock implícito en profiles)
    UPDATE public.profiles
    SET    balance_mxn = balance_mxn + v_bet.potential_payout
    WHERE  id = v_bet.user_id
    RETURNING balance_mxn INTO v_balance_after;

    -- 7b. Marcar apuesta como ganada
    UPDATE public.bets
    SET    status = 'won'
    WHERE  id = v_bet.id;

    -- 7c. Registrar transacción de ganancia
    INSERT INTO public.transactions (user_id, type, amount, balance_after)
    VALUES (v_bet.user_id, 'win', v_bet.potential_payout, v_balance_after);

    v_winners_paid := v_winners_paid + 1;
    v_total_payout := v_total_payout + v_bet.potential_payout;
  END LOOP;

  -- ── 8. Devolver resumen ──────────────────────────────────────────────────
  RETURN json_build_object(
    'market_id',    p_market_id,
    'result',       p_winning_side,
    'winners_paid', v_winners_paid,
    'total_payout', v_total_payout
  );
END;
$$;

-- Solo usuarios autenticados pueden llamarla (el admin check está dentro)
REVOKE ALL  ON FUNCTION public.resolve_market(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_market(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.resolve_market IS
  'Cierra un mercado atómicamente: paga potential_payout a ganadores, '
  'marca perdedores como lost y registra transacciones. '
  'Solo ejecutable por admin (outfisin@gmail.com). '
  'Idempotente: falla si el mercado ya está cerrado.';
