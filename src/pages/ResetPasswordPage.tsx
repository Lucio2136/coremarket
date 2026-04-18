import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Lock, Eye, EyeOff, CheckCircle } from "lucide-react";

export default function ResetPasswordPage() {
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);
  const [validSession, setValid]  = useState(false);
  const { updatePassword }        = useAuth();
  const navigate                  = useNavigate();

  // Supabase inyecta el token en el hash de la URL al abrir el enlace del email.
  // onAuthStateChange lo procesa con evento PASSWORD_RECOVERY.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setValid(true);
    });
    // Si la sesión ya existe (hash ya procesado antes del mount)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setValid(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setLoading(true);
    try {
      await updatePassword(password);
      setDone(true);
      toast.success("Contraseña actualizada correctamente");
      setTimeout(() => navigate("/"), 2500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar contraseña");
    } finally { setLoading(false); }
  };

  // ── Éxito ────────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
        <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
          <CheckCircle size={28} className="text-emerald-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">¡Contraseña actualizada!</h1>
        <p className="text-sm text-gray-400">Redirigiendo al inicio...</p>
      </div>
    );
  }

  // ── Sesión inválida (acceso directo sin el enlace) ───────────────────────
  if (!validSession) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
        <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center">
          <Lock size={24} className="text-amber-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Enlace inválido o expirado</h1>
        <p className="text-sm text-gray-400 max-w-sm">
          Este enlace de recuperación ya expiró o es incorrecto. Solicita uno nuevo desde la pantalla de inicio de sesión.
        </p>
        <button
          onClick={() => navigate("/")}
          className="px-5 py-2 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors"
        >
          Ir al inicio
        </button>
      </div>
    );
  }

  // ── Formulario ───────────────────────────────────────────────────────────
  return (
    <div className="max-w-sm mx-auto mt-12 px-4">
      <div className="border border-gray-200 rounded-2xl bg-white p-6 shadow-sm space-y-5">

        <div className="text-center space-y-1">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
            <Lock size={18} className="text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Nueva contraseña</h1>
          <p className="text-[13px] text-gray-400">Elige una contraseña segura para tu cuenta.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-gray-700">Nueva contraseña</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 pr-10 text-sm text-gray-800 focus:outline-none focus:border-blue-400 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-gray-700">Confirmar contraseña</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repite la contraseña"
              required
              minLength={6}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-blue-400 transition-colors"
            />
            {confirm && password !== confirm && (
              <p className="text-[11px] text-rose-500 font-medium">Las contraseñas no coinciden</p>
            )}
            {confirm && password === confirm && confirm.length >= 6 && (
              <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle size={11} /> Contraseñas coinciden
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || password !== confirm || password.length < 6}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {loading ? "Guardando..." : "Guardar contraseña"}
          </button>
        </form>
      </div>
    </div>
  );
}
