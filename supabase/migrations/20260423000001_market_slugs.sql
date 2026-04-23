-- Agrega slugs amigables a los mercados para URLs legibles
-- /market/ganara-amlo-las-elecciones en lugar de /market/uuid

-- Función para generar slug desde texto español
CREATE OR REPLACE FUNCTION public.slugify(v text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT lower(
    regexp_replace(
      regexp_replace(
        translate(trim(v),
          'áéíóúüàèìòùâêîôûäëïöüñÁÉÍÓÚÜÀÈÌÒÙÂÊÎÔÛÄËÏÖÜÑ¿?¡!',
          'aeiouuaeiouaeiouaeiounAEIOUUAEIOUAEIOUAEIOUN     '
        ),
        '[^a-z0-9\s]', '', 'g'
      ),
      '\s+', '-', 'g'
    )
  );
$$;

-- Columna slug en markets
ALTER TABLE public.markets ADD COLUMN IF NOT EXISTS slug text;

-- Backfill: generar slug para mercados existentes
-- Si hay duplicados, agrega los primeros 6 chars del UUID
UPDATE public.markets m
SET slug = sub.final_slug
FROM (
  SELECT
    id,
    CASE
      WHEN count(*) OVER (PARTITION BY base_slug) > 1
        THEN base_slug || '-' || left(id::text, 6)
      ELSE base_slug
    END AS final_slug
  FROM (
    SELECT id, public.slugify(title) AS base_slug FROM public.markets
  ) t
) sub
WHERE m.id = sub.id;

-- Índice único (permite NULL para nuevos mercados antes de tener slug)
CREATE UNIQUE INDEX IF NOT EXISTS idx_markets_slug ON public.markets(slug)
  WHERE slug IS NOT NULL;

-- Trigger: auto-generar slug al insertar un mercado nuevo
CREATE OR REPLACE FUNCTION public.markets_set_slug()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  base_slug text;
  candidate text;
  counter   int := 0;
BEGIN
  IF NEW.slug IS NOT NULL AND NEW.slug <> '' THEN
    RETURN NEW;
  END IF;

  base_slug := public.slugify(NEW.title);
  candidate := base_slug;

  LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.markets WHERE slug = candidate AND id <> NEW.id
    );
    counter   := counter + 1;
    candidate := base_slug || '-' || counter;
  END LOOP;

  NEW.slug := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_markets_set_slug ON public.markets;
CREATE TRIGGER trg_markets_set_slug
  BEFORE INSERT ON public.markets
  FOR EACH ROW EXECUTE FUNCTION public.markets_set_slug();
