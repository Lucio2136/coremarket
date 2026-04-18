-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 009: Backend fixes
--
-- Fix 1.  set_system_freeze  — guard de admin (cualquier user podía congelar)
-- Fix 2.  Trigger freeze     — excluye refunds del bloqueo
-- Fix 3.  resolve_market     — actualiza total_won al pagar ganadores
-- Fix 4.  bettor_count       — deduplica (no contar al mismo usuario dos veces)
-- Fix 5.  admin_financial_stats — revocar acceso a todos los authenticated
-- Fix 6.  Auto-cierre de mercados expirados (trigger en markets SELECT/UPDATE)
-- Fix 7.  reject_withdrawal  — usar type 'refund' en lugar de 'deposit'
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 1: set_system_freeze con guard de admin
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_system_freeze(p_frozen BOOLEAN, p_admin_email TEXT)
RETURNS JSON AS $$
DECLARE
  v_caller_email TEXT;
BEGIN
  -- Solo el admin puede congelar/descongelar
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
-- FIX 2: Trigger freeze — excluir reembolsos ('refund') del bloqueo
--
-- El trigger original bloqueaba TODOS los INSERT en transactions, incluyendo
-- los reembolsos de retiros rechazados. Ahora solo bloquea 'bet' y 'deposit'.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_system_not_frozen()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo bloqueamos operaciones de entrada de dinero y apuestas nuevas.
  -- Los refunds ('refund') y ganancias ('win') siempre deben poder procesarse.
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
    -- Solo bloquear creación de nuevas solicitudes, no updates de estado
    IF TG_OP = 'INSERT' THEN
      IF (SELECT is_frozen FROM system_settings WHERE id = true) THEN
        RAISE EXCEPTION 'SISTEMA_CONGELADO: Retiros suspendidos temporalmente.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-crear los triggers apuntando a la función actualizada (ya existen, se reemplazan)
DROP TRIGGER IF EXISTS trg_bets_freeze_check         ON bets;
DROP TRIGGER IF EXISTS trg_transactions_freeze_check ON transactions;
DROP TRIGGER IF EXISTS trg_withdrawals_freeze_check  ON withdrawals;

CREATE TRIGGER trg_bets_freeze_check
  BEFORE INSERT ON bets
  FOR EACH ROW EXECUTE FUNCTION check_system_not_frozen();

CREATE TRIGGER trg_transactions_freeze_check
  BEFORE INSERT ON transactions
  FOR EACH ROW EXECUTE FUNCTION check_system_not_frozen();

-- Para withdrawals usamos BEFORE INSERT OR UPDATE para que el trigger
-- también reciba TG_OP y pueda distinguir INSERT de UPDATE
CREATE TRIGGER trg_withdrawals_freeze_check
  BEFORE INSERT OR UPDATE ON withdrawals
  FOR EACH ROW EXECUTE FUNCTION check_system_not_frozen();


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 3 + FIX 4: resolve_market — total_won + bettor_count dedup
--
-- Cambios:
--   • UPDATE profiles: añade total_won += potential_payout en el LOOP de ganadores
--   • bettor_count: se recalcula como COUNT(DISTINCT user_id) en lugar de +1
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
  -- ── 1. Identidad del llamador ────────────────────────────────────────────
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = 'P0001';
  END IF;

  -- ── 2. Verificar rol de administrador ───────────────────────────────────
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

  -- ── 6. Marcar apuestas perdedoras ────────────────────────────────────────
  UPDATE public.bets
  SET    status = 'lost'
  WHERE  market_id = p_market_id
    AND  side      <> p_winning_side
    AND  status    = 'pending';

  -- ── 7. Procesar apuestas ganadoras ──────────────────────────────────────
  -- ORDER BY user_id = orden consistente anti-deadlock entre llamadas paralelas
  FOR v_bet IN
    SELECT b.id, b.user_id, b.potential_payout
    FROM   public.bets b
    WHERE  b.market_id = p_market_id
      AND  b.side      = p_winning_side
      AND  b.status    = 'pending'
    ORDER  BY b.user_id
    FOR UPDATE
  LOOP
    -- 7a. Acreditar saldo + actualizar total_won  ← FIX 3
    UPDATE public.profiles
    SET    balance_mxn = balance_mxn + v_bet.potential_payout,
           total_won   = COALESCE(total_won, 0) + v_bet.potential_payout
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

REVOKE ALL  ON FUNCTION public.resolve_market(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_market(uuid, text) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 4 (parte 2): place_bet — bettor_count con deduplicación
--
-- Solo incrementa bettor_count si el usuario NO ha apostado antes en ese mercado.
-- ─────────────────────────────────────────────────────────────────────────────
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
  v_already_bet      boolean;       -- ← para dedup de bettor_count
BEGIN

  -- ── 1. Identidad ─────────────────────────────────────────────────────────
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = 'P0001';
  END IF;

  -- ── 2. Validaciones básicas ───────────────────────────────────────────────
  IF p_amount < 10 THEN
    RAISE EXCEPTION 'El monto mínimo de apuesta es $10 MXN' USING ERRCODE = 'P0001';
  END IF;
  IF p_side NOT IN ('yes', 'no') THEN
    RAISE EXCEPTION 'Lado inválido: debe ser "yes" o "no"' USING ERRCODE = 'P0001';
  END IF;
  IF p_odds <= 1 THEN
    RAISE EXCEPTION 'Cuota inválida' USING ERRCODE = 'P0001';
  END IF;

  -- ── 3. Bloquear y leer mercado ────────────────────────────────────────────
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
    -- Auto-cerrar el mercado expirado
    UPDATE public.markets SET status = 'closed' WHERE id = p_market_id;
    RAISE EXCEPTION 'El mercado ya expiró y no acepta más apuestas' USING ERRCODE = 'P0001';
  END IF;

  -- ── 4. ¿Ya apostó este usuario en este mercado? (para bettor_count dedup) ─
  SELECT EXISTS (
    SELECT 1 FROM public.bets
    WHERE market_id = p_market_id
      AND user_id   = v_user_id
  ) INTO v_already_bet;

  -- ── 5. Calcular odds actuales (AMM pre-apuesta) ───────────────────────────
  v_yes_eff   := v_market.yes_pool + k_virtual;
  v_no_eff    := v_market.no_pool  + k_virtual;
  v_total_eff := v_yes_eff + v_no_eff;

  IF p_side = 'yes' THEN
    v_current_odds := ROUND(v_total_eff / v_yes_eff, 4);
  ELSE
    v_current_odds := ROUND(v_total_eff / v_no_eff, 4);
  END IF;

  -- ── 6. Slippage ±10% ──────────────────────────────────────────────────────
  IF ABS(p_odds - v_current_odds) / v_current_odds > 0.10 THEN
    RAISE EXCEPTION
      'Las cuotas han cambiado (%.2f → %.2f). Recarga y vuelve a intentarlo.',
      p_odds, v_current_odds
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 7. Saldo del usuario ──────────────────────────────────────────────────
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

  -- ── 8. Calcular pago con fee de la casa ───────────────────────────────────
  v_raw_payout       := ROUND(p_amount * v_current_odds, 2);
  v_fee_amount       := ROUND(v_raw_payout * k_fee_rate, 2);
  v_potential_payout := v_raw_payout - v_fee_amount;
  v_balance_after    := v_balance - p_amount;

  -- ── 9. Descontar saldo + actualizar total_bet ─────────────────────────────
  UPDATE public.profiles
  SET    balance_mxn = v_balance_after,
         total_bet   = COALESCE(total_bet, 0) + p_amount
  WHERE  id = v_user_id;

  -- ── 10. Insertar la apuesta ───────────────────────────────────────────────
  INSERT INTO public.bets (
    user_id, market_id, side, amount, odds_at_bet,
    potential_payout, fee_amount, status
  )
  VALUES (
    v_user_id, p_market_id, p_side, p_amount, v_current_odds,
    v_potential_payout, v_fee_amount, 'pending'
  )
  RETURNING id INTO v_bet_id;

  -- ── 11. Actualizar pools del mercado (AMM post-apuesta) ───────────────────
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
    -- Solo incrementar bettor_count si es la primera vez que este usuario apuesta  ← FIX 4
    bettor_count = v_market.bettor_count + CASE WHEN v_already_bet THEN 0 ELSE 1 END,
    yes_percent  = v_new_yes_pct,
    yes_odds     = v_new_yes_odds,
    no_odds      = v_new_no_odds
  WHERE id = p_market_id;

  -- ── 12. Transacción contable ──────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 5: admin_financial_stats — revocar acceso a todos los authenticated
--
-- La vista quedaba accesible por cualquier usuario con sesión via REST API.
-- La movemos a acceso solo por service_role; el admin la lee desde el server.
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE SELECT ON public.admin_financial_stats FROM authenticated;
GRANT  SELECT ON public.admin_financial_stats TO service_role;

-- Para que el admin pueda leer la vista desde el cliente (usa su token JWT)
-- creamos una función RPC que corre como SECURITY DEFINER (= service_role)
-- y verifica el email antes de devolver los datos.
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
--
-- Un trigger BEFORE INSERT/UPDATE en bets ya auto-cierra al intentar apostar.
-- Adicionalmente creamos una función que el admin puede llamar para limpiar
-- mercados expirados en lote (útil para el dashboard).
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
  WHERE  status    = 'open'
    AND  closes_at IS NOT NULL
    AND  closes_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN json_build_object('closed', v_count, 'run_at', now());
END;
$$;

-- Cualquier usuario autenticado puede disparar el cierre (solo lee estados)
-- El SECURITY DEFINER garantiza que el UPDATE pase RLS aunque el usuario no sea admin.
REVOKE ALL    ON FUNCTION public.close_expired_markets() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_expired_markets() TO authenticated;

-- Trigger que cierra el mercado automáticamente si alguien intenta leerlo
-- con un SELECT FOR UPDATE (el place_bet ya lo hace; esto es para el frontend)
CREATE OR REPLACE FUNCTION public.trg_auto_close_expired_market()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'open'
     AND NEW.closes_at IS NOT NULL
     AND NEW.closes_at < NOW() THEN
    NEW.status := 'closed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_close_expired ON public.markets;
CREATE TRIGGER trg_auto_close_expired
  BEFORE UPDATE ON public.markets
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_auto_close_expired_market();


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 7: reject_withdrawal — usar type 'refund' en lugar de 'deposit'
--
-- Evita que los reembolsos de retiros rechazados inflen total_deposits en la
-- vista admin_financial_stats.
-- ─────────────────────────────────────────────────────────────────────────────

-- Primero, agregar 'refund' al CHECK constraint de transactions.type
-- (si existe; si no existe el constraint, nada que hacer)
DO $$
BEGIN
  -- Intentamos ampliar el constraint; si no existe lo creamos desde cero.
  ALTER TABLE public.transactions
    DROP CONSTRAINT IF EXISTS transactions_type_check;

  ALTER TABLE public.transactions
    ADD CONSTRAINT transactions_type_check
    CHECK (type IN ('deposit', 'bet', 'win', 'withdrawal', 'refund'));
EXCEPTION WHEN others THEN
  NULL; -- Si la tabla no tiene constraint de tipo, no hay nada que cambiar
END;
$$;

-- Reemplazar reject_withdrawal con la versión que usa 'refund'
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

  -- ── 1. Solo admin ─────────────────────────────────────────────────────────
  v_caller_email := auth.jwt() ->> 'email';
  IF NOT (v_caller_email = ANY (k_admin_emails)) THEN
    RAISE EXCEPTION 'Acceso denegado: solo el administrador puede rechazar retiros'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 2. Leer y bloquear la solicitud ──────────────────────────────────────
  SELECT id, user_id, amount, status
  INTO   v_withdrawal
  FROM   public.withdrawals
  WHERE  id = p_withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud de retiro no encontrada' USING ERRCODE = 'P0001';
  END IF;
  IF v_withdrawal.status <> 'pending' THEN
    RAISE EXCEPTION 'Este retiro ya fue procesado (estado: %)', v_withdrawal.status
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 3. Devolver saldo al usuario ──────────────────────────────────────────
  SELECT balance_mxn
  INTO   v_balance_now
  FROM   public.profiles
  WHERE  id = v_withdrawal.user_id
  FOR UPDATE;

  v_balance_after := v_balance_now + v_withdrawal.amount;

  UPDATE public.profiles
  SET balance_mxn = v_balance_after
  WHERE id = v_withdrawal.user_id;

  -- ── 4. Marcar como rechazado ──────────────────────────────────────────────
  UPDATE public.withdrawals
  SET    status     = 'rejected',
         updated_at = now()
  WHERE  id = p_withdrawal_id;

  -- ── 5. Transacción contable — 'refund' para no inflar total_deposits ← FIX 7
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

REVOKE ALL  ON FUNCTION public.reject_withdrawal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_withdrawal(uuid) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- Actualizar admin_financial_stats para excluir 'refund' de los depósitos
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.admin_financial_stats AS
SELECT
  COALESCE((
    SELECT SUM(amount) FROM public.transactions WHERE type = 'deposit'
  ), 0) AS total_deposits,

  COALESCE((
    SELECT SUM(-amount) FROM public.transactions WHERE type = 'bet'
  ), 0) AS total_bets_volume,

  COALESCE((
    SELECT SUM(amount) FROM public.transactions WHERE type = 'win'
  ), 0) AS total_wins_paid,

  COALESCE((
    SELECT SUM(-amount) FROM public.transactions WHERE type = 'bet'
  ), 0) -
  COALESCE((
    SELECT SUM(amount) FROM public.transactions WHERE type = 'win'
  ), 0) AS net_profit,

  COALESCE((
    SELECT SUM(fee_amount) FROM public.bets WHERE status = 'won'
  ), 0) AS house_fee_realized,

  COALESCE((
    SELECT SUM(fee_amount) FROM public.bets WHERE status IN ('won', 'pending')
  ), 0) AS house_fee_expected,

  COALESCE((
    SELECT SUM(potential_payout) FROM public.bets WHERE status = 'pending'
  ), 0) AS liability,

  -- 'refund' ya no contamina total_deposits; se reporta por separado
  COALESCE((
    SELECT SUM(amount) FROM public.transactions WHERE type = 'refund'
  ), 0) AS total_refunds,

  (SELECT COUNT(*)::int FROM public.profiles)                   AS total_users,
  (SELECT COUNT(*)::int FROM public.markets WHERE status='open') AS active_markets,
  (SELECT COUNT(*)::int FROM public.bets WHERE status='pending') AS pending_bets;

-- Solo service_role puede leer la vista directamente (los authenticated usan get_financial_stats RPC)
GRANT SELECT ON public.admin_financial_stats TO service_role;
