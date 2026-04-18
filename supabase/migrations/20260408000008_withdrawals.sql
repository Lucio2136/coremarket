-- ============================================================
-- Migration 008: Módulo de Retiros
--
-- 1. Tabla withdrawals — solicitudes de retiro de usuarios
-- 2. RPC request_withdrawal — congela saldo y crea solicitud
-- 3. RPC approve_withdrawal — admin marca como pagado
-- 4. RPC reject_withdrawal  — admin rechaza y devuelve saldo
-- ============================================================

-- ── 1. Tabla withdrawals ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount       numeric     NOT NULL CHECK (amount > 0),
  status       text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'approved', 'rejected')),
  bank_details jsonb       NOT NULL DEFAULT '{}',
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Índice para consultas del admin (todos pending)
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals (status, created_at DESC);
-- Índice para consultas del usuario (sus retiros)
CREATE INDEX IF NOT EXISTS idx_withdrawals_user   ON public.withdrawals (user_id, created_at DESC);

-- ── 2. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

-- Los usuarios solo ven sus propios retiros
DO $$ BEGIN
  CREATE POLICY "users_select_own_withdrawals"
    ON public.withdrawals FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- El admin ve todos los retiros (OR'd con la policy anterior — suma, no reemplaza)
DO $$ BEGIN
  CREATE POLICY "admin_select_all_withdrawals"
    ON public.withdrawals FOR SELECT
    TO authenticated
    USING ((auth.jwt() ->> 'email') = ANY (ARRAY['outfisin@gmail.com']));
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- ── 3. request_withdrawal — usuario solicita un retiro ────────────────────────
DROP FUNCTION IF EXISTS public.request_withdrawal(numeric, jsonb);

CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_amount       numeric,
  p_bank_details jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id       uuid;
  v_balance       numeric;
  v_balance_after numeric;
  v_withdrawal_id uuid;
BEGIN

  -- ── 1. Identidad ──────────────────────────────────────────────────────────────
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = 'P0001';
  END IF;

  -- ── 2. Validaciones básicas ───────────────────────────────────────────────────
  IF p_amount < 50 THEN
    RAISE EXCEPTION 'El monto mínimo de retiro es $50 MXN' USING ERRCODE = 'P0001';
  END IF;
  IF p_bank_details IS NULL
     OR (p_bank_details ->> 'clabe') IS NULL
     OR length(p_bank_details ->> 'clabe') <> 18 THEN
    RAISE EXCEPTION 'CLABE inválida — debe tener exactamente 18 dígitos' USING ERRCODE = 'P0001';
  END IF;

  -- ── 3. Leer y bloquear saldo ──────────────────────────────────────────────────
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

  v_balance_after := v_balance - p_amount;

  -- ── 4. Congelar saldo (descontar inmediatamente) ──────────────────────────────
  UPDATE public.profiles
  SET balance_mxn = v_balance_after
  WHERE id = v_user_id;

  -- ── 5. Insertar solicitud ─────────────────────────────────────────────────────
  INSERT INTO public.withdrawals (user_id, amount, status, bank_details)
  VALUES (v_user_id, p_amount, 'pending', p_bank_details)
  RETURNING id INTO v_withdrawal_id;

  -- ── 6. Transacción contable ───────────────────────────────────────────────────
  INSERT INTO public.transactions (user_id, type, amount, balance_after)
  VALUES (v_user_id, 'withdrawal', -p_amount, v_balance_after);

  RETURN json_build_object(
    'withdrawal_id', v_withdrawal_id,
    'amount',        p_amount,
    'status',        'pending',
    'balance_after', v_balance_after
  );
END;
$$;

REVOKE ALL  ON FUNCTION public.request_withdrawal(numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric, jsonb) TO authenticated;

-- ── 4. approve_withdrawal — admin confirma que el pago fue enviado ────────────
DROP FUNCTION IF EXISTS public.approve_withdrawal(uuid);

CREATE OR REPLACE FUNCTION public.approve_withdrawal(
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
BEGIN

  -- ── 1. Solo admin ─────────────────────────────────────────────────────────────
  v_caller_email := auth.jwt() ->> 'email';
  IF NOT (v_caller_email = ANY (k_admin_emails)) THEN
    RAISE EXCEPTION 'Acceso denegado: solo el administrador puede aprobar retiros'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 2. Leer y bloquear la solicitud ──────────────────────────────────────────
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

  -- ── 3. Marcar como aprobado ───────────────────────────────────────────────────
  -- El saldo ya fue descontado al solicitar — no se modifica de nuevo.
  UPDATE public.withdrawals
  SET    status     = 'approved',
         updated_at = now()
  WHERE  id = p_withdrawal_id;

  RETURN json_build_object(
    'withdrawal_id', p_withdrawal_id,
    'status',        'approved'
  );
END;
$$;

REVOKE ALL  ON FUNCTION public.approve_withdrawal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_withdrawal(uuid) TO authenticated;

-- ── 5. reject_withdrawal — admin rechaza y devuelve el dinero ─────────────────
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

  -- ── 1. Solo admin ─────────────────────────────────────────────────────────────
  v_caller_email := auth.jwt() ->> 'email';
  IF NOT (v_caller_email = ANY (k_admin_emails)) THEN
    RAISE EXCEPTION 'Acceso denegado: solo el administrador puede rechazar retiros'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 2. Leer y bloquear la solicitud ──────────────────────────────────────────
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

  -- ── 3. Devolver saldo al usuario ──────────────────────────────────────────────
  SELECT balance_mxn
  INTO   v_balance_now
  FROM   public.profiles
  WHERE  id = v_withdrawal.user_id
  FOR UPDATE;

  v_balance_after := v_balance_now + v_withdrawal.amount;

  UPDATE public.profiles
  SET balance_mxn = v_balance_after
  WHERE id = v_withdrawal.user_id;

  -- ── 4. Marcar como rechazado ──────────────────────────────────────────────────
  UPDATE public.withdrawals
  SET    status     = 'rejected',
         updated_at = now()
  WHERE  id = p_withdrawal_id;

  -- ── 5. Transacción contable de reversión ──────────────────────────────────────
  -- Usamos 'deposit' ya que es el tipo más cercano disponible en el constraint
  INSERT INTO public.transactions (user_id, type, amount, balance_after)
  VALUES (v_withdrawal.user_id, 'deposit', v_withdrawal.amount, v_balance_after);

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
