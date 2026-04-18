-- ─────────────────────────────────────────────────────────────────────────────
-- GLOBAL FREEZE — tabla system_settings + triggers de seguridad
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Tabla de configuración global (siempre una sola fila)
CREATE TABLE IF NOT EXISTS system_settings (
  id        BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  is_frozen BOOLEAN NOT NULL DEFAULT false,
  frozen_at TIMESTAMPTZ,
  frozen_by TEXT
);

INSERT INTO system_settings (id, is_frozen)
VALUES (true, false)
ON CONFLICT DO NOTHING;

-- 2. Función que bloquea si el sistema está congelado
CREATE OR REPLACE FUNCTION check_system_not_frozen()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT is_frozen FROM system_settings WHERE id = true) THEN
    RAISE EXCEPTION 'SISTEMA_CONGELADO: Operaciones suspendidas temporalmente por el administrador.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger en bets (apuestas)
DROP TRIGGER IF EXISTS trg_bets_freeze_check ON bets;
CREATE TRIGGER trg_bets_freeze_check
  BEFORE INSERT ON bets
  FOR EACH ROW EXECUTE FUNCTION check_system_not_frozen();

-- 4. Trigger en transactions (depósitos / créditos)
DROP TRIGGER IF EXISTS trg_transactions_freeze_check ON transactions;
CREATE TRIGGER trg_transactions_freeze_check
  BEFORE INSERT ON transactions
  FOR EACH ROW EXECUTE FUNCTION check_system_not_frozen();

-- 5. Trigger en withdrawals (retiros)
DROP TRIGGER IF EXISTS trg_withdrawals_freeze_check ON withdrawals;
CREATE TRIGGER trg_withdrawals_freeze_check
  BEFORE INSERT ON withdrawals
  FOR EACH ROW EXECUTE FUNCTION check_system_not_frozen();

-- 6. RLS: solo el service_role puede leer/escribir system_settings
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_only" ON system_settings;
CREATE POLICY "service_role_only" ON system_settings
  USING (true)
  WITH CHECK (true);

-- Los clientes anon/authenticated solo pueden leer is_frozen
DROP POLICY IF EXISTS "public_read_frozen" ON system_settings;
CREATE POLICY "public_read_frozen" ON system_settings
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- 7. Función RPC para que el admin pueda cambiar el estado de freeze
CREATE OR REPLACE FUNCTION set_system_freeze(p_frozen BOOLEAN, p_admin_email TEXT)
RETURNS JSON AS $$
BEGIN
  UPDATE system_settings
  SET
    is_frozen = p_frozen,
    frozen_at = CASE WHEN p_frozen THEN now() ELSE NULL END,
    frozen_by = CASE WHEN p_frozen THEN p_admin_email ELSE NULL END
  WHERE id = true;

  RETURN json_build_object(
    'is_frozen', p_frozen,
    'frozen_at', CASE WHEN p_frozen THEN now() ELSE NULL END,
    'frozen_by', CASE WHEN p_frozen THEN p_admin_email ELSE NULL END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
