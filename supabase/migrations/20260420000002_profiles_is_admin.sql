-- ═══════════════════════════════════════════════════════════════════════════
-- Columna is_admin en profiles
--
-- Mueve la verificación de admin del frontend a la base de datos.
-- El trigger bloquea que cualquier cliente (rol 'authenticated') pueda
-- modificar is_admin directamente — solo service_role puede hacerlo.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Marcar al admin actual
UPDATE public.profiles
SET is_admin = true
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'outfisin@gmail.com' LIMIT 1
);

-- Trigger: bloquear cambios a is_admin desde el cliente
CREATE OR REPLACE FUNCTION public.trg_block_is_admin_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin
     AND current_user = 'authenticated' THEN
    RAISE EXCEPTION 'is_admin solo puede modificarse por el servidor'
      USING ERRCODE = 'P0003';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_is_admin_update ON public.profiles;
CREATE TRIGGER trg_block_is_admin_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_block_is_admin_update();
