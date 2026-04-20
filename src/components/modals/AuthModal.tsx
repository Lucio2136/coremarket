import React, { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Mail, ArrowLeft, CheckCircle, Eye, EyeOff } from "lucide-react";

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

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="#1877F2" aria-hidden="true">
      <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.791-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
    </svg>
  );
}

type View = "login" | "signup" | "forgot" | "verify";

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
  const [oauthLoading, setOauthLoading] = useState<"google" | "facebook" | null>(null);
  const [showLoginPw, setShowLoginPw]   = useState(false);
  const [showSignupPw, setShowSignupPw] = useState(false);
  const { signIn, signUp, signInWithGoogle, signInWithFacebook, resetPasswordEmail } = useAuth();

  const reset = () => { setEmail(""); setPassword(""); setUsername(""); setReferral(""); };

  const handleClose = (v: boolean) => {
    onOpenChange(v);
    if (!v) { reset(); setView("login"); }
  };

  // ── Login ────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      handleClose(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de autenticación");
    } finally { setLoading(false); }
  };

  // ── Registro ─────────────────────────────────────────────────────────────
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validar username: solo letras, números y guión bajo, 3-20 chars
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      toast.error("Usuario: 3-20 caracteres, solo letras, números y _");
      return;
    }
    if (password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (!/[0-9]/.test(password) && !/[^a-zA-Z0-9]/.test(password)) {
      toast.error("La contraseña debe incluir al menos un número o símbolo");
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

  // ── OAuth ────────────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setOauthLoading("google");
    try { await signInWithGoogle(); }
    catch { toast.error("No se pudo conectar con Google"); setOauthLoading(null); }
  };

  const handleFacebook = async () => {
    setOauthLoading("facebook");
    try { await signInWithFacebook(); }
    catch { toast.error("No se pudo conectar con Facebook"); setOauthLoading(null); }
  };

  // ── Recuperar contraseña ─────────────────────────────────────────────────
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="p-0 border-0 bg-transparent shadow-none sm:max-w-[400px]">
        <Card className="w-full border border-gray-200 shadow-lg">

          {/* ── Vista: Verificación enviada ── */}
          {view === "verify" && (
            <>
              <CardHeader className="pb-2">
                <div className="flex flex-col items-center text-center gap-3 pt-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                    <CheckCircle size={24} className="text-emerald-500" />
                  </div>
                  <CardTitle className="text-xl font-bold text-gray-900">Verifica tu correo</CardTitle>
                  <CardDescription className="text-[13px] leading-relaxed">
                    Enviamos un enlace de verificación a{" "}
                    <span className="font-semibold text-gray-700">{email}</span>.
                    Haz clic en el enlace para activar tu cuenta.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="bg-amber-50 border border-amber-200/70 rounded-xl p-3 text-[12px] text-amber-700 leading-relaxed">
                  <strong>¿No lo ves?</strong> Revisa tu carpeta de spam o correo no deseado.
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-2 pt-2">
                <Button
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold"
                  onClick={() => handleClose(false)}
                >
                  Entendido
                </Button>
                <button
                  type="button"
                  onClick={() => { setView("login"); reset(); }}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Volver al inicio de sesión
                </button>
              </CardFooter>
            </>
          )}

          {/* ── Vista: Recuperar contraseña ── */}
          {view === "forgot" && (
            <>
              <CardHeader>
                <button
                  type="button"
                  onClick={() => { setView("login"); setEmail(""); }}
                  className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-700 transition-colors mb-2 -ml-0.5"
                >
                  <ArrowLeft size={13} /> Volver
                </button>
                <CardTitle className="text-xl font-bold text-gray-900">Recuperar contraseña</CardTitle>
                <CardDescription>Te enviaremos un enlace para crear una nueva contraseña.</CardDescription>
              </CardHeader>
              <CardContent>
                <form id="forgot-form" onSubmit={handleForgot} className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="forgot-email">Correo electrónico</Label>
                    <div className="relative">
                      <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      <Input
                        id="forgot-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu@correo.com"
                        required
                        className="bg-gray-50 border-gray-200 pl-9"
                      />
                    </div>
                  </div>
                </form>
              </CardContent>
              <CardFooter className="flex-col gap-2">
                <Button
                  type="submit"
                  form="forgot-form"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  disabled={loading}
                >
                  {loading ? "Enviando..." : "Enviar enlace"}
                </Button>
              </CardFooter>
            </>
          )}

          {/* ── Vista: Login ── */}
          {view === "login" && (
            <>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold text-gray-900">Inicia sesión</CardTitle>
                    <CardDescription className="mt-1">Bienvenido de regreso</CardDescription>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setView("signup"); reset(); }}
                    className="text-sm text-blue-600 font-semibold hover:underline whitespace-nowrap mt-0.5"
                  >
                    Regístrate
                  </button>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {/* OAuth buttons */}
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={!!oauthLoading}
                  className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-2.5 text-[13px] font-semibold text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {oauthLoading === "google" ? <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" /> : <GoogleIcon />}
                  Continuar con Google
                </button>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-[11px] text-gray-400 font-medium">o con correo</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>
                <form id="login-form" onSubmit={handleLogin} className="flex flex-col gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="login-email">Correo electrónico</Label>
                    <Input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" required className="bg-gray-50 border-gray-200" />
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password">Contraseña</Label>
                      <button
                        type="button"
                        onClick={() => setView("forgot")}
                        className="text-[12px] text-blue-600 hover:underline font-medium"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    </div>
                    <div className="relative">
                      <Input id="login-password" type={showLoginPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="bg-gray-50 border-gray-200 pr-10" />
                      <button type="button" onClick={() => setShowLoginPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showLoginPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                </form>
              </CardContent>
              <CardFooter className="flex-col gap-2">
                <Button type="submit" form="login-form" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold" disabled={loading}>
                  {loading ? "Cargando..." : "Entrar"}
                </Button>
                <p className="text-center text-xs text-gray-500">
                  ¿No tienes cuenta?{" "}
                  <button type="button" onClick={() => { setView("signup"); reset(); }} className="text-blue-600 font-semibold hover:underline">
                    Regístrate gratis
                  </button>
                </p>
              </CardFooter>
            </>
          )}

          {/* ── Vista: Registro ── */}
          {view === "signup" && (
            <>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold text-gray-900">Crear cuenta</CardTitle>
                    <CardDescription className="mt-1">Regístrate para empezar a predecir</CardDescription>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setView("login"); reset(); }}
                    className="text-sm text-blue-600 font-semibold hover:underline whitespace-nowrap mt-0.5"
                  >
                    Iniciar sesión
                  </button>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {/* OAuth buttons */}
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={!!oauthLoading}
                  className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-2.5 text-[13px] font-semibold text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {oauthLoading === "google" ? <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" /> : <GoogleIcon />}
                  Continuar con Google
                </button>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-[11px] text-gray-400 font-medium">o con correo</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>
                <form id="signup-form" onSubmit={handleSignUp} className="flex flex-col gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="signup-username">Nombre de usuario</Label>
                    <Input
                      id="signup-username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20))}
                      placeholder="tu_usuario"
                      required
                      minLength={3}
                      maxLength={20}
                      className="bg-gray-50 border-gray-200"
                    />
                    {username.length > 0 && username.length < 3 && (
                      <p className="text-[11px] text-rose-500">Mínimo 3 caracteres</p>
                    )}
                    {username.length >= 3 && (
                      <p className="text-[11px] text-emerald-600">✓ Solo letras, números y _</p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="signup-referral">
                      Código de referido{" "}
                      <span className="text-gray-400 font-normal">(opcional)</span>
                    </Label>
                    <Input
                      id="signup-referral"
                      value={referralCode}
                      onChange={(e) => setReferral(e.target.value.toUpperCase())}
                      placeholder="Ej. AB12CD34"
                      maxLength={8}
                      className="bg-gray-50 border-gray-200 font-mono tracking-widest"
                    />
                    {referralCode.trim().length > 0 && (
                      <p className="text-[11px] text-emerald-600 font-medium">+$50 MXN de bono al registrarte</p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="signup-email">Correo electrónico</Label>
                    <Input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" required className="bg-gray-50 border-gray-200" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="signup-password">Contraseña</Label>
                    <div className="relative">
                      <Input id="signup-password" type={showSignupPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" required minLength={8} className="bg-gray-50 border-gray-200 pr-10" />
                      <button type="button" onClick={() => setShowSignupPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showSignupPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                </form>
              </CardContent>
              <CardFooter className="flex-col gap-2">
                <Button type="submit" form="signup-form" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold" disabled={loading}>
                  {loading ? "Creando cuenta..." : "Crear cuenta"}
                </Button>
                <p className="text-center text-xs text-gray-500">
                  ¿Ya tienes cuenta?{" "}
                  <button type="button" onClick={() => { setView("login"); reset(); }} className="text-blue-600 font-semibold hover:underline">
                    Inicia sesión
                  </button>
                </p>
              </CardFooter>
            </>
          )}

        </Card>
      </DialogContent>
    </Dialog>
  );
};
