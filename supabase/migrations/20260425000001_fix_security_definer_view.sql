-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: admin_financial_stats con security_invoker=true
--
-- El linter de Supabase detecta que la view corre con los permisos del
-- creador (postgres), bypasseando RLS.  Con security_invoker=true corre
-- con los permisos del rol que la consulta, respetando RLS.
-- El acceso real al admin sigue controlado por get_financial_stats()
-- (SECURITY DEFINER con check de email) y por los GRANTs de abajo.
-- ─────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.admin_financial_stats;

CREATE VIEW public.admin_financial_stats
WITH (security_invoker = true)
AS
SELECT
  COALESCE((SELECT SUM(amount)       FROM public.transactions WHERE type = 'deposit'),    0) AS total_deposits,
  COALESCE((SELECT SUM(-amount)      FROM public.transactions WHERE type = 'bet'),         0) AS total_bets_volume,
  COALESCE((SELECT SUM(amount)       FROM public.transactions WHERE type = 'win'),         0) AS total_wins_paid,
  COALESCE((SELECT SUM(-amount)      FROM public.transactions WHERE type = 'bet'),         0)
    - COALESCE((SELECT SUM(amount)   FROM public.transactions WHERE type = 'win'),         0) AS net_profit,
  COALESCE((SELECT SUM(fee_amount)   FROM public.bets WHERE status = 'won'),               0) AS house_fee_realized,
  COALESCE((SELECT SUM(fee_amount)   FROM public.bets WHERE status IN ('won','pending')),  0) AS house_fee_expected,
  COALESCE((SELECT SUM(potential_payout) FROM public.bets WHERE status = 'pending'),       0) AS liability,
  COALESCE((SELECT SUM(amount)       FROM public.transactions WHERE type = 'refund'),      0) AS total_refunds,
  (SELECT COUNT(*)::int FROM public.profiles)                                                  AS total_users,
  (SELECT COUNT(*)::int FROM public.markets WHERE status = 'open')                             AS active_markets,
  (SELECT COUNT(*)::int FROM public.bets    WHERE status = 'pending')                          AS pending_bets;

-- Solo service_role puede consultar la view directamente.
-- Los usuarios autenticados pasan por get_financial_stats() que verifica email de admin.
REVOKE ALL   ON public.admin_financial_stats FROM PUBLIC;
REVOKE SELECT ON public.admin_financial_stats FROM authenticated;
GRANT  SELECT ON public.admin_financial_stats TO service_role;
