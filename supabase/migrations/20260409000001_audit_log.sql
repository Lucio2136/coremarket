-- ============================================================
-- Migration 009: Módulo de Auditoría Financiera
--
-- 1. Tabla audit_log — histórico de auditorías
-- 2. RPC run_financial_audit — ejecuta auditoría y guarda resultado
-- ============================================================

-- ── 1. Tabla audit_log ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at       timestamptz NOT NULL DEFAULT now(),
  run_by       text        NOT NULL,
  dinero_real  numeric     NOT NULL,
  pasivo_total numeric     NOT NULL,
  gap          numeric     NOT NULL,   -- dinero_real - pasivo_total (positivo = solvente)
  is_balanced  boolean     NOT NULL,
  detail       jsonb       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_audit_log_run_at ON public.audit_log (run_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_only_audit_log"
  ON public.audit_log FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email') = ANY (ARRAY['outfisin@gmail.com']));

-- ── 2. RPC run_financial_audit ────────────────────────────────────────────────
-- Lógica de balanceo:
--   dinero_real  = Depósitos Stripe reales - Retiros aprobados enviados
--   pasivo_total = Saldos de usuarios + Retiros pendientes (por enviar) + Liability de apuestas abiertas
--
-- "Depósitos Stripe reales" = todos los transactions(type='deposit')
--   MENOS los que corresponden a reembolsos de retiros rechazados.
--   Cada rechazo crea un transaction(type='deposit', amount=withdrawal.amount).
--   Por eso restamos SUM(withdrawals WHERE status='rejected').
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.run_financial_audit();

CREATE OR REPLACE FUNCTION public.run_financial_audit()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  k_admin_emails CONSTANT text[] := ARRAY['outfisin@gmail.com'];
  v_caller_email  text;

  -- Activo
  v_all_deposit_txns     numeric;
  v_rejected_withdrawals numeric;
  v_stripe_deposits      numeric;
  v_approved_withdrawals numeric;
  v_dinero_real          numeric;

  -- Pasivo
  v_sum_balances           numeric;
  v_pending_withdrawals    numeric;
  v_pending_bets_liability numeric;
  v_pasivo_total           numeric;

  v_gap         numeric;
  v_is_balanced boolean;
  v_audit_id    uuid;
BEGIN

  -- ── Autorización ────────────────────────────────────────────────────────────
  -- COALESCE: cuando se llama desde SQL Editor (service_role, sin JWT) el email
  -- es null — se registra como 'service_role' y se permite pasar.
  v_caller_email := COALESCE(auth.jwt() ->> 'email', 'service_role');
  IF v_caller_email <> 'service_role'
     AND NOT (v_caller_email = ANY(k_admin_emails)) THEN
    RAISE EXCEPTION 'Solo el administrador puede ejecutar auditorías'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Activo: dinero real en la caja ──────────────────────────────────────────
  -- Todas las transacciones tipo 'deposit' (Stripe + reembolsos internos)
  SELECT COALESCE(SUM(amount), 0)
  INTO   v_all_deposit_txns
  FROM   public.transactions
  WHERE  type = 'deposit';

  -- Reembolsos internos (retiros rechazados — no son dinero real de Stripe)
  SELECT COALESCE(SUM(amount), 0)
  INTO   v_rejected_withdrawals
  FROM   public.withdrawals
  WHERE  status = 'rejected';

  -- Solo depósitos reales de Stripe
  v_stripe_deposits := v_all_deposit_txns - v_rejected_withdrawals;

  -- Dinero ya enviado fuera del banco (SPEI aprobados)
  SELECT COALESCE(SUM(amount), 0)
  INTO   v_approved_withdrawals
  FROM   public.withdrawals
  WHERE  status = 'approved';

  v_dinero_real := v_stripe_deposits - v_approved_withdrawals;

  -- ── Pasivo: total de obligaciones ───────────────────────────────────────────
  -- Saldos libres de usuarios (lo que pueden retirar en este momento)
  SELECT COALESCE(SUM(balance_mxn), 0)
  INTO   v_sum_balances
  FROM   public.profiles;

  -- Retiros pendientes de enviar (ya descontados de balance_mxn pero aún en banco)
  SELECT COALESCE(SUM(amount), 0)
  INTO   v_pending_withdrawals
  FROM   public.withdrawals
  WHERE  status = 'pending';

  -- Liability máxima: lo que debemos si TODAS las apuestas abiertas ganan
  SELECT COALESCE(SUM(potential_payout), 0)
  INTO   v_pending_bets_liability
  FROM   public.bets
  WHERE  status = 'pending';

  v_pasivo_total := v_sum_balances + v_pending_withdrawals + v_pending_bets_liability;

  -- ── Resultado ────────────────────────────────────────────────────────────────
  v_gap         := v_dinero_real - v_pasivo_total;
  v_is_balanced := v_gap >= 0;

  -- ── Guardar en audit_log ─────────────────────────────────────────────────────
  INSERT INTO public.audit_log (
    run_by, dinero_real, pasivo_total, gap, is_balanced, detail
  ) VALUES (
    v_caller_email,
    v_dinero_real,
    v_pasivo_total,
    v_gap,
    v_is_balanced,
    jsonb_build_object(
      'stripe_deposits',       v_stripe_deposits,
      'approved_withdrawals',  v_approved_withdrawals,
      'sum_balances',          v_sum_balances,
      'pending_withdrawals',   v_pending_withdrawals,
      'pending_bets_liability',v_pending_bets_liability
    )
  )
  RETURNING id INTO v_audit_id;

  RETURN json_build_object(
    'audit_id',    v_audit_id,
    'run_at',      now(),
    'run_by',      v_caller_email,
    'dinero_real', v_dinero_real,
    'pasivo_total',v_pasivo_total,
    'gap',         v_gap,
    'is_balanced', v_is_balanced,
    'detail', jsonb_build_object(
      'stripe_deposits',       v_stripe_deposits,
      'approved_withdrawals',  v_approved_withdrawals,
      'sum_balances',          v_sum_balances,
      'pending_withdrawals',   v_pending_withdrawals,
      'pending_bets_liability',v_pending_bets_liability
    )
  );
END;
$$;

REVOKE ALL   ON FUNCTION public.run_financial_audit() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_financial_audit() TO authenticated;
