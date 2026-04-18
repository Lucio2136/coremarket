-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: market_price_history
--
-- Registra un snapshot del yes_percent después de cada apuesta.
-- El frontend lo usa para mostrar la gráfica de probabilidad histórica
-- en la página de detalle de cada mercado.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Tabla ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.market_price_history (
  id            uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  market_id     uuid          NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  yes_percent   numeric(5,1)  NOT NULL,
  recorded_at   timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_price_history_market_time
  ON public.market_price_history (market_id, recorded_at);

-- ── RLS: lectura pública ────────────────────────────────────────────────────
ALTER TABLE public.market_price_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read price history" ON public.market_price_history;
CREATE POLICY "Public read price history"
  ON public.market_price_history
  FOR SELECT
  USING (true);

GRANT SELECT ON public.market_price_history TO anon, authenticated;

-- ── Trigger: registrar snapshot cuando cambia yes_percent ──────────────────
CREATE OR REPLACE FUNCTION public.trg_record_price_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.yes_percent IS DISTINCT FROM OLD.yes_percent THEN
    INSERT INTO public.market_price_history (market_id, yes_percent, recorded_at)
    VALUES (NEW.id, NEW.yes_percent, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_market_price_history ON public.markets;
CREATE TRIGGER trg_market_price_history
  AFTER UPDATE ON public.markets
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_record_price_history();

-- ── Seed: un punto inicial para todos los mercados abiertos existentes ──────
INSERT INTO public.market_price_history (market_id, yes_percent, recorded_at)
SELECT id, COALESCE(yes_percent, 50), now()
FROM   public.markets
WHERE  status = 'open';
