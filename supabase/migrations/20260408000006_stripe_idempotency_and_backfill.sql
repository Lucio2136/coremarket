-- ============================================================
-- Migration 006: Idempotencia Stripe + backfill total_bet / total_won
-- ============================================================

-- ── 1. Restricción UNIQUE en stripe_payment_intent_id ────────────────────────
--   Garantiza a nivel de base de datos que el mismo payment intent
--   nunca se acredite dos veces, aunque el webhook llegue duplicado.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

-- Índice único parcial: solo aplica a filas que tienen el campo (depósitos).
-- Las demás transacciones (bet, win) no tienen este campo y no se ven afectadas.
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_stripe_pi
  ON public.transactions (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- ── 2. Backfill: total_bet desde apuestas existentes ─────────────────────────
UPDATE public.profiles p
SET total_bet = COALESCE((
  SELECT SUM(b.amount)
  FROM   public.bets b
  WHERE  b.user_id = p.id
), 0)
WHERE total_bet IS DISTINCT FROM COALESCE((
  SELECT SUM(b.amount)
  FROM   public.bets b
  WHERE  b.user_id = p.id
), 0);

-- ── 3. Backfill: total_won desde apuestas ganadas ─────────────────────────────
UPDATE public.profiles p
SET total_won = COALESCE((
  SELECT SUM(b.potential_payout)
  FROM   public.bets b
  WHERE  b.user_id = p.id
    AND  b.status  = 'won'
), 0)
WHERE total_won IS DISTINCT FROM COALESCE((
  SELECT SUM(b.potential_payout)
  FROM   public.bets b
  WHERE  b.user_id = p.id
    AND  b.status  = 'won'
), 0);
