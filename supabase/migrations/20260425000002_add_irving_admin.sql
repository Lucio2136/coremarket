-- Marcar irvingomarlc@gmail.com como admin
UPDATE public.profiles
SET is_admin = true
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'irvingomarlc@gmail.com' LIMIT 1
);
