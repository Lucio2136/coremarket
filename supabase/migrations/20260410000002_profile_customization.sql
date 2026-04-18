-- Migration: profile customization
-- Agrega bio y color de avatar a profiles.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio          TEXT,
  ADD COLUMN IF NOT EXISTS avatar_color TEXT NOT NULL DEFAULT 'violet';
