-- ═══════════════════════════════════════════════════════════════════════════
-- Tabla security_events — ISO/IEC 27001 A.12.4.1 (Registro de eventos)
--
-- Registra accesos admin y acciones críticas de forma inmutable.
-- Solo admins pueden leer; la escritura es exclusiva del RPC (SECURITY DEFINER).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.security_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  text        NOT NULL,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email  text,
  resource    text,
  details     jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_events_user_id   ON public.security_events (user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_event     ON public.security_events (event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_created   ON public.security_events (created_at DESC);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden leer los eventos
CREATE POLICY "security_events_admin_select"
  ON public.security_events FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Nadie puede insertar directamente desde el cliente (solo vía RPC)
-- No se crea política INSERT → denegado por defecto

-- ── RPC log_security_event ────────────────────────────────────────────────────
-- SECURITY DEFINER: corre como postgres, puede insertar aunque no haya
-- política INSERT para el rol 'authenticated'.

CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type text,
  p_resource   text  DEFAULT NULL,
  p_details    jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.security_events (event_type, user_id, user_email, resource, details)
  SELECT
    p_event_type,
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    p_resource,
    p_details;
END;
$$;

REVOKE ALL    ON FUNCTION public.log_security_event(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_security_event(text, text, jsonb) TO authenticated;
