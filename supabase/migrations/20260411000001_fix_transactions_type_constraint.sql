-- Fix: asegurar que el constraint de transactions.type incluye 'withdrawal' y 'refund'
-- El DO block anterior (backend_fixes) podía fallar silenciosamente.
-- Este script es idempotente y fuerza el constraint correcto.

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('deposit', 'bet', 'win', 'withdrawal', 'refund'));
