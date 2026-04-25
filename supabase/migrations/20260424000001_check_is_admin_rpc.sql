-- ═══════════════════════════════════════════════════════════════════════════
-- RPC check_is_admin — verificación server-side de privilegio admin
--
-- SECURITY DEFINER: ejecuta como owner (postgres), no como el cliente.
-- auth.uid() viene del JWT firmado por Supabase — no puede ser suplantado
-- desde el navegador aunque el usuario manipule el estado local de React.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Sin sesión activa → no es admin
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT is_admin
  INTO   v_is_admin
  FROM   public.profiles
  WHERE  id = auth.uid();

  RETURN COALESCE(v_is_admin, false);
END;
$$;

-- Solo usuarios autenticados pueden llamar esta función
REVOKE ALL   ON FUNCTION public.check_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_is_admin() TO authenticated;
