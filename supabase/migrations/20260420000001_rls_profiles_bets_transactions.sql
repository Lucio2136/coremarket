-- ═══════════════════════════════════════════════════════════════════════════
-- RLS: profiles, bets, transactions
--
-- Las funciones SECURITY DEFINER (place_bet, resolve_market, etc.) corren
-- como owner (postgres) y bypasean RLS — no se rompe nada en el servidor.
--
-- Regla de balance_mxn: solo cambia vía RPCs. El trigger trg_block_balance_update
-- bloquea cualquier UPDATE directo al campo desde el rol 'authenticated'
-- (e.g. supabase-js client, REST API directa).
-- ═══════════════════════════════════════════════════════════════════════════


-- ── profiles ─────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: usuario ve su propio perfil
DROP POLICY IF EXISTS "profiles_select_own"   ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- SELECT: admin ve todos los perfiles
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- UPDATE: usuario puede editar su propio perfil (username, avatar, etc.)
-- balance_mxn está protegido por trg_block_balance_update más abajo
DROP POLICY IF EXISTS "profiles_update_own"   ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- INSERT/DELETE: sin política → denegado (solo service_role vía Auth trigger)


-- ── Trigger: bloquear cambios directos a balance_mxn ─────────────────────────
--
-- current_user = 'authenticated' cuando la petición viene del cliente (PostgREST).
-- current_user = 'postgres'      cuando corre una función SECURITY DEFINER.
-- Así las RPCs siguen pudiendo actualizar el saldo sin tocar este bloqueo.

CREATE OR REPLACE FUNCTION public.trg_block_balance_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.balance_mxn IS DISTINCT FROM OLD.balance_mxn
     AND current_user = 'authenticated' THEN
    RAISE EXCEPTION 'balance_mxn solo puede modificarse a través de funciones del servidor (place_bet, resolve_market, etc.)'
      USING ERRCODE = 'P0003';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_balance_update ON public.profiles;
CREATE TRIGGER trg_block_balance_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_block_balance_update();


-- ── bets ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;

-- SELECT: usuario ve sus propias apuestas
DROP POLICY IF EXISTS "bets_select_own"   ON public.bets;
CREATE POLICY "bets_select_own"
  ON public.bets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- SELECT: admin ve todas las apuestas
DROP POLICY IF EXISTS "bets_select_admin" ON public.bets;
CREATE POLICY "bets_select_admin"
  ON public.bets FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- INSERT/UPDATE/DELETE: sin política → denegado (solo vía RPCs SECURITY DEFINER)


-- ── transactions ──────────────────────────────────────────────────────────────

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- SELECT: usuario ve sus propias transacciones
DROP POLICY IF EXISTS "transactions_select_own"   ON public.transactions;
CREATE POLICY "transactions_select_own"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- SELECT: admin ve todas las transacciones
DROP POLICY IF EXISTS "transactions_select_admin" ON public.transactions;
CREATE POLICY "transactions_select_admin"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- INSERT/UPDATE/DELETE: sin política → denegado (solo vía RPCs SECURITY DEFINER)
