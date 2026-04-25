-- ═══════════════════════════════════════════════════════════════════════════
-- Unificar verificación de admin en RLS
--
-- La función public.is_admin() era usada por las políticas RLS de markets,
-- profiles, bets y transactions, pero verificaba por email hardcodeado.
-- Ahora lee la columna profiles.is_admin igual que check_is_admin(),
-- para que ambas funciones sean consistentes.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;
