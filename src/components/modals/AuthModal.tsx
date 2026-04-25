import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Mail, ArrowLeft, CheckCircle, Eye, EyeOff, X } from "lucide-react";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

type View = "login" | "signup" | "forgot" | "verify";

const PW_RULES = [
  { id: "length",  label: "Mínimo 8 caracteres",     test: (p: string) => p.length >= 8 },
  { id: "upper",   label: "Una letra mayúscula",      test: (p: string) => /[A-Z]/.test(p) },
  { id: "lower",   label: "Una letra minúscula",      test: (p: string) => /[a-z]/.test(p) },
  { id: "number",  label: "Un número",                test: (p: string) => /[0-9]/.test(p) },
  { id: "symbol",  label: "Un símbolo (!@#$%...)",    test: (p: string) => /[^a-zA-Z0-9]/.test(p) },
];

function isStrongPassword(p: string) {
  return PW_RULES.every((r) => r.test(p));
}

function PasswordStrengthHints({ password }: { password: string }) {
  if (!password) return null;
  return (
    <ul className="mt-2 flex flex-col gap-1">
      {PW_RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <li key={rule.id} className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${ok ? "text-emerald-600" : "text-rose-500"}`}>
            <span className="shrink-0">{ok ? "✓" : "✗"}</span>
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ open, onOpenChange }) => {
  const [view, setView]             = useState<View>("login");
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [username, setUsername]     = useState("");
  const [referralCode, setReferral] = useState("");
  const [loading, setLoading]       = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | null>(null);
  const [showLoginPw, setShowLoginPw]   = useState(false);
  const [showSignupPw, setShowSignupPw] = useState(false);
  const { signIn, signUp, signInWithGoogle, resetPasswordEmail } = useAuth();

  const reset = () => { setEmail(""); setPassword(""); setUsername(""); setReferral(""); };

  const handleClose = () => {
    onOpenChange(false);
    reset();
    setView("login");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de autenticación");
    } finally { setLoading(false); }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      toast.error("Usuario: 3-20 caracteres, solo letras, números y _");
      return;
    }
    if (!isStrongPassword(password)) {
      toast.error("La contraseña no cumple los requisitos de seguridad");
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, username, referralCode);
      setView("verify");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear cuenta");
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setOauthLoading("google");
    try { await signInWithGoogle(); }
    catch { toast.error("No se pudo conectar con Google"); setOauthLoading(null); }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await resetPasswordEmail(email);
      toast.success("Correo enviado. Revisa tu bandeja de entrada.");
      setView("login");
      setEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al enviar correo");
    } finally { setLoading(false); }
  };

  const inputCls = "w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3.5 text-[15px] text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 focus:outline-none focus:border-blue-400 focus:bg-white dark:focus:bg-gray-750 transition-colors placeholder:text-gray-300 dark:placeholder:text-gray-600";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          onClick={handleClose}
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-[400px] bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col"
            style={{ maxHeight: "92vh", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            {/* Drag handle móvil */}
            <div className="flex justify-center pt-3 pb-0 sm:hidden shrink-0">
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
            </div>

            {/* Contenido scrollable */}
            <div className="overflow-y-auto flex-1">
              <div className="px-5 pt-4 pb-6 flex flex-col gap-4">

                {/* ── Verificación enviada ── */}
                {view === "verify" && (
                  <>
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Verifica tu correo</h2>
                      <button onClick={handleClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><X size={18} /></button>
                    </div>
                    <div className="flex flex-col items-center text-center gap-3 py-4">
                      <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                        <CheckCircle size={28} className="text-emerald-500" />
                      </div>
                      <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
                        Enviamos un enlace de verificación a{" "}
                        <span className="font-semibold text-gray-700 dark:text-gray-300">{email}</span>.
                        Haz clic en el enlace para activar tu cuenta.
                      </p>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3 text-[12px] text-amber-700 dark:text-amber-400 leading-relaxed">
                      <strong>¿No lo ves?</strong> Revisa tu carpeta de spam.
                    </div>
                    <Button className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold" onClick={handleClose}>
                      Entendido
                    </Button>
                    <button type="button" onClick={() => { setView("login"); reset(); }} className="text-xs text-center text-gray-400 hover:text-gray-600 transition-colors">
                      Volver al inicio de sesión
                    </button>
                  </>
                )}

                {/* ── Recuperar contraseña ── */}
                {view === "forgot" && (
                  <>
                    <div className="flex items-center justify-between">
                      <button type="button" onClick={() => { setView("login"); setEmail(""); }} className="flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                        <ArrowLeft size={14} /> Volver
                      </button>
                      <button onClick={handleClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><X size={18} /></button>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Recuperar contraseña</h2>
                      <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1">Te enviaremos un enlace para crear una nueva contraseña.</p>
                    </div>
                    <form onSubmit={handleForgot} className="flex flex-col gap-4">
                      <div>
                        <label className="text-[12px] font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">Correo electrónico</label>
                        <div className="relative">
                          <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" required className={`${inputCls} pl-9`} />
                        </div>
                      </div>
                      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold" disabled={loading}>
                        {loading ? "Enviando..." : "Enviar enlace"}
                      </Button>
                    </form>
                  </>
                )}

                {/* ── Login ── */}
                {view === "login" && (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Inicia sesión</h2>
                        <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">Bienvenido de regreso</p>
                      </div>
                      <button onClick={handleClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><X size={18} /></button>
                    </div>

                    <button type="button" onClick={handleGoogle} disabled={!!oauthLoading}
                      className="w-full flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-700 rounded-xl py-3 text-[13px] font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors disabled:opacity-50">
                      {oauthLoading === "google" ? <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" /> : <GoogleIcon />}
                      Continuar con Google
                    </button>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                      <span className="text-[11px] text-gray-400 font-medium">o con correo</span>
                      <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                    </div>

                    <form onSubmit={handleLogin} className="flex flex-col gap-3">
                      <div>
                        <label className="text-[12px] font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">Correo electrónico</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" required className={inputCls} />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[12px] font-medium text-gray-600 dark:text-gray-400">Contraseña</label>
                          <button type="button" onClick={() => setView("forgot")} className="text-[12px] text-blue-600 hover:underline font-medium">
                            ¿Olvidaste tu contraseña?
                          </button>
                        </div>
                        <div className="relative">
                          <input type={showLoginPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className={`${inputCls} pr-11`} />
                          <button type="button" onClick={() => setShowLoginPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
                            {showLoginPw ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>
                      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold mt-1" disabled={loading}>
                        {loading ? "Cargando..." : "Entrar"}
                      </Button>
                    </form>

                    <p className="text-center text-[13px] text-gray-500 dark:text-gray-400">
                      ¿No tienes cuenta?{" "}
                      <button type="button" onClick={() => { setView("signup"); reset(); }} className="text-blue-600 font-semibold hover:underline">
                        Regístrate gratis
                      </button>
                    </p>
                  </>
                )}

                {/* ── Registro ── */}
                {view === "signup" && (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Crear cuenta</h2>
                        <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">Regístrate para empezar a predecir</p>
                      </div>
                      <button onClick={handleClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><X size={18} /></button>
                    </div>

                    <button type="button" onClick={handleGoogle} disabled={!!oauthLoading}
                      className="w-full flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-700 rounded-xl py-3 text-[13px] font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors disabled:opacity-50">
                      {oauthLoading === "google" ? <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" /> : <GoogleIcon />}
                      Continuar con Google
                    </button>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                      <span className="text-[11px] text-gray-400 font-medium">o con correo</span>
                      <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                    </div>

                    <form onSubmit={handleSignUp} className="flex flex-col gap-3">
                      <div>
                        <label className="text-[12px] font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">Nombre de usuario</label>
                        <input
                          value={username}
                          onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20))}
                          placeholder="tu_usuario"
                          required
                          minLength={3}
                          maxLength={20}
                          className={inputCls}
                        />
                        {username.length > 0 && username.length < 3 && (
                          <p className="text-[11px] text-rose-500 mt-1">Mínimo 3 caracteres</p>
                        )}
                        {username.length >= 3 && (
                          <p className="text-[11px] text-emerald-600 mt-1">✓ Solo letras, números y _</p>
                        )}
                      </div>
                      <div>
                        <label className="text-[12px] font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">
                          Código de referido <span className="text-gray-400 font-normal">(opcional)</span>
                        </label>
                        <input
                          value={referralCode}
                          onChange={(e) => setReferral(e.target.value.toUpperCase())}
                          placeholder="Ej. AB12CD34"
                          maxLength={8}
                          className={`${inputCls} font-mono tracking-widest`}
                        />
                        {referralCode.trim().length > 0 && (
                          <p className="text-[11px] text-emerald-600 font-medium mt-1">+$50 MXN de bono al registrarte</p>
                        )}
                      </div>
                      <div>
                        <label className="text-[12px] font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">Correo electrónico</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" required className={inputCls} />
                      </div>
                      <div>
                        <label className="text-[12px] font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">Contraseña</label>
                        <div className="relative">
                          <input type={showSignupPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" required minLength={8} className={`${inputCls} pr-11`} />
                          <button type="button" onClick={() => setShowSignupPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
                            {showSignupPw ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                        <PasswordStrengthHints password={password} />
                      </div>
                      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold mt-1" disabled={loading}>
                        {loading ? "Creando cuenta..." : "Crear cuenta"}
                      </Button>
                    </form>

                    <p className="text-center text-[13px] text-gray-500 dark:text-gray-400">
                      ¿Ya tienes cuenta?{" "}
                      <button type="button" onClick={() => { setView("login"); reset(); }} className="text-blue-600 font-semibold hover:underline">
                        Inicia sesión
                      </button>
                    </p>
                  </>
                )}

              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
