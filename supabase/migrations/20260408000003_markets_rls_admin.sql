-- ============================================================
-- RLS policies para tabla markets
-- Solo el admin puede escribir; cualquiera puede leer.
-- ============================================================

-- Lectura pública (mercados visibles para todos)
DROP POLICY IF EXISTS "Markets are viewable by everyone" ON public.markets;
CREATE POLICY "Markets are viewable by everyone"
  ON public.markets FOR SELECT
  USING (true);

-- Helper: verifica si el caller es admin
-- Se usa en las políticas de escritura para no repetir la subquery.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND email = 'outfisin@gmail.com'
  );
$$;

-- INSERT — solo admin
DROP POLICY IF EXISTS "Admin can insert markets" ON public.markets;
CREATE POLICY "Admin can insert markets"
  ON public.markets FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- UPDATE — solo admin
DROP POLICY IF EXISTS "Admin can update markets" ON public.markets;
CREATE POLICY "Admin can update markets"
  ON public.markets FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- DELETE — solo admin
DROP POLICY IF EXISTS "Admin can delete markets" ON public.markets;
CREATE POLICY "Admin can delete markets"
  ON public.markets FOR DELETE
  TO authenticated
  USING (public.is_admin());
