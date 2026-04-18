-- Migration: referral system
-- Agrega código de referido a perfiles y RPC para aplicar el bono.
-- Bono: $50 MXN para quien refiere + $50 MXN para el nuevo usuario.
-- Seguro para correr con datos existentes (balance_mxn, transactions, etc.).

-- ── Columnas en profiles ────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code         TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by           TEXT,
  ADD COLUMN IF NOT EXISTS referral_count        INTEGER  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_earnings_mxn NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Generar código para usuarios existentes (incluye el que ya tiene $1500).
-- Usa los primeros 8 hex del UUID sin guiones → determinista y único.
UPDATE public.profiles
SET referral_code = UPPER(SUBSTRING(REPLACE(id::TEXT, '-', ''), 1, 8))
WHERE referral_code IS NULL;

-- Trigger: auto-generar código en nuevos registros
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := UPPER(SUBSTRING(REPLACE(NEW.id::TEXT, '-', ''), 1, 8));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_referral_code ON public.profiles;
CREATE TRIGGER trg_generate_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.generate_referral_code();

-- ── RPC: apply_referral ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_referral(
  p_user_id       UUID,
  p_referral_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_referrer_id      UUID;
  v_bonus            NUMERIC := 50;
  v_new_user_balance NUMERIC;
  v_referrer_balance NUMERIC;
BEGIN
  -- Validar código no vacío
  IF TRIM(p_referral_code) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'codigo_vacio');
  END IF;

  -- Buscar referidor (no puede ser el mismo usuario)
  SELECT id INTO v_referrer_id
  FROM public.profiles
  WHERE referral_code = UPPER(TRIM(p_referral_code))
    AND id <> p_user_id;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'codigo_invalido');
  END IF;

  -- Verificar que el nuevo usuario no haya sido referido antes
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND referred_by IS NOT NULL
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ya_referido');
  END IF;

  -- Acreditar al nuevo usuario y obtener saldo resultante
  UPDATE public.profiles
  SET balance_mxn = balance_mxn + v_bonus,
      referred_by = UPPER(TRIM(p_referral_code))
  WHERE id = p_user_id
  RETURNING balance_mxn INTO v_new_user_balance;

  INSERT INTO public.transactions (user_id, type, amount, balance_after, description)
  VALUES (p_user_id, 'deposit', v_bonus, v_new_user_balance, 'Bono de bienvenida por referido');

  -- Acreditar al referidor y obtener saldo resultante
  UPDATE public.profiles
  SET balance_mxn           = balance_mxn + v_bonus,
      referral_count        = referral_count + 1,
      referral_earnings_mxn = referral_earnings_mxn + v_bonus
  WHERE id = v_referrer_id
  RETURNING balance_mxn INTO v_referrer_balance;

  INSERT INTO public.transactions (user_id, type, amount, balance_after, description)
  VALUES (v_referrer_id, 'deposit', v_bonus, v_referrer_balance, 'Bono por referir a un amigo');

  RETURN jsonb_build_object('ok', true, 'bonus', v_bonus);
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_referral(UUID, TEXT) TO authenticated;
