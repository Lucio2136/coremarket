-- Migration: auto-close markets via pg_cron
-- Ejecuta cada hora al minuto 0 y cierra los mercados cuyo closes_at ya pasó.
-- Requiere que la extensión pg_cron esté habilitada en Supabase
-- (Dashboard → Database → Extensions → pg_cron).

-- Habilitar extensión si no está activa (Supabase la incluye, solo hay que activarla)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Registrar el job solo si no existe (idempotente sin necesitar permisos sobre cron.job)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-close-markets') THEN
    PERFORM cron.schedule(
      'auto-close-markets',
      '0 * * * *',
      'UPDATE public.markets SET status = ''closed'' WHERE closes_at < NOW() AND status = ''open'';'
    );
  END IF;
END;
$$;
