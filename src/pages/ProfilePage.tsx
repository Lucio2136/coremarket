import { useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { AuthModal } from "@/components/modals/AuthModal";
import { DepositModal } from "@/components/modals/DepositModal";
import { WithdrawModal } from "@/components/modals/WithdrawModal";
import { useMyBets } from "@/hooks/use-my-bets";
import { useTransactions } from "@/hooks/use-transactions";
import { useWithdrawals, Withdrawal } from "@/hooks/use-withdrawals";
import { supabase } from "@/lib/supabase";
import {
  Wallet, TrendingUp, Target, Plus, LogIn,
  ArrowDownCircle, ArrowUpCircle, Trophy, Loader2,
  ArrowLeftRight, Clock, CheckCircle, XCircle, Building2,
  Pencil, X, Check, Lock, Camera, Trash2, Eye, EyeOff,
} from "lucide-react";
import { Transaction } from "@/lib/supabase";
import { toast } from "sonner";

// ─── Paleta de avatares ──────────────────────────────────────────────────────

const AVATAR_COLORS: { id: string; gradient: string; ring: string }[] = [
  { id: "violet", gradient: "from-violet-500 to-pink-500",   ring: "ring-violet-400" },
  { id: "blue",   gradient: "from-blue-500 to-cyan-400",     ring: "ring-blue-400"   },
  { id: "green",  gradient: "from-emerald-500 to-teal-400",  ring: "ring-emerald-400"},
  { id: "orange", gradient: "from-orange-400 to-amber-300",  ring: "ring-orange-400" },
  { id: "rose",   gradient: "from-rose-500 to-pink-400",     ring: "ring-rose-400"   },
  { id: "indigo", gradient: "from-indigo-500 to-violet-400", ring: "ring-indigo-400" },
];

function fmt(n: number) {
  return n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric", month: "short", year: "numeric",
  });
}

const TX_CONFIG: Record<string, { label: string; icon: typeof ArrowDownCircle; color: string; sign: string }> = {
  deposit:    { label: "Depósito",  icon: ArrowDownCircle,  color: "text-emerald-600", sign: "+" },
  win:        { label: "Premio",    icon: Trophy,            color: "text-emerald-600", sign: "+" },
  withdrawal: { label: "Retiro",    icon: ArrowUpCircle,     color: "text-rose-500",    sign: "−" },
  bet:        { label: "Posición",   icon: ArrowLeftRight,    color: "text-gray-500",    sign: "−" },
  loss:       { label: "Pérdida",   icon: ArrowLeftRight,    color: "text-rose-400",    sign: "−" },
};

const WD_STATUS = {
  pending:  { label: "Pendiente", icon: Clock,         cls: "bg-amber-50 text-amber-700 border-amber-200"   },
  approved: { label: "Pagado",    icon: CheckCircle,   cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "Rechazado", icon: XCircle,       cls: "bg-rose-50 text-rose-600 border-rose-200"      },
};

function WithdrawalRow({ w }: { w: Withdrawal }) {
  const cfg  = WD_STATUS[w.status];
  const Icon = cfg.icon;
  const clabe = w.bank_details?.clabe ?? "";
  const clabeShort = clabe.length >= 4 ? `••• ${clabe.slice(-4)}` : clabe;

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
        <Building2 size={14} className="text-gray-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[13px] font-semibold text-gray-900">
            Retiro ${fmt(w.amount)}
          </p>
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.cls}`}>
            <Icon size={10} />
            {cfg.label}
          </span>
        </div>
        <p className="text-[11px] text-gray-400 mt-0.5">
          {w.bank_details?.bank_name} {clabeShort} · {fmtDate(w.created_at)}
        </p>
        {w.status === "rejected" && (
          <p className="text-[11px] text-emerald-600 mt-0.5">Saldo reintegrado a tu cuenta</p>
        )}
      </div>
      <p className="text-[13px] font-bold text-gray-700 tabular-nums shrink-0">
        −${fmt(w.amount)}
      </p>
    </div>
  );
}

function TxRow({ tx }: { tx: Transaction }) {
  const cfg = TX_CONFIG[tx.type] ?? { label: tx.type, icon: ArrowLeftRight, color: "text-gray-400", sign: "" };
  const Icon = cfg.icon;
  const isPositive = cfg.sign === "+";

  return (
    <div className="flex items-center gap-3 py-3">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isPositive ? "bg-emerald-50" : "bg-gray-100"}`}>
        <Icon size={15} className={cfg.color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-gray-900">
          {cfg.label}
          {tx.description && (
            <span className="font-normal text-gray-400 ml-1 text-[12px] truncate">— {tx.description}</span>
          )}
        </p>
        <p className="text-[11px] text-gray-400">{fmtDate(tx.created_at)}</p>
      </div>
      <p className={`text-[13px] font-bold tabular-nums shrink-0 ${isPositive ? "text-emerald-600" : "text-gray-700"}`}>
        {cfg.sign}${fmt(tx.amount)}
      </p>
    </div>
  );
}

export default function ProfilePage() {
  const { user, profile, balance, isAuthenticated, updateProfile, refreshProfile } = useAuth();
  const { bets } = useMyBets();
  const { transactions, loading: txLoading } = useTransactions(100);
  const { withdrawals, loading: wdLoading } = useWithdrawals();
  const [authOpen, setAuthOpen]         = useState(false);
  const [depositOpen, setDepositOpen]   = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [txFilter, setTxFilter]         = useState<"all" | "deposit" | "win" | "bet">("all");

  // ── Edición de perfil ──
  const [editing, setEditing]           = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio]           = useState("");
  const [editColor, setEditColor]       = useState("violet");
  const [saving, setSaving]             = useState(false);
  const [uploading, setUploading]       = useState(false);
  const fileInputRef                    = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("La imagen debe ser menor a 2 MB"); return; }

    setUploading(true);
    try {
      const ext  = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      await updateProfile({ avatar_url: url });
      toast.success("Foto actualizada");
    } catch (err: any) {
      toast.error(err?.message ?? "Error al subir foto");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAvatar = async () => {
    if (!user) return;
    setUploading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success("Foto eliminada");
    } catch (err: any) {
      toast.error(err?.message ?? "Error al eliminar foto");
    } finally {
      setUploading(false);
    }
  };

  // ── Cambio de contraseña ──
  const [pwOpen, setPwOpen]       = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw]         = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPws, setShowPws]     = useState([false, false, false]);
  const [pwSaving, setPwSaving]   = useState(false);

  const startEdit = () => {
    setEditUsername(profile?.username ?? "");
    setEditBio(profile?.bio ?? "");
    setEditColor(profile?.avatar_color ?? "violet");
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const saveEdit = async () => {
    if (!editUsername.trim()) return;
    setSaving(true);
    try {
      await updateProfile({
        username:     editUsername.trim(),
        bio:          editBio.trim() || undefined,
        avatar_color: editColor,
      });
      toast.success("Perfil actualizado");
      setEditing(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async () => {
    if (newPw !== confirmPw) { toast.error("Las contraseñas no coinciden"); return; }
    if (newPw.length < 6)    { toast.error("Mínimo 6 caracteres");           return; }
    setPwSaving(true);
    try {
      // Verificar contraseña actual reautenticando
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: currentPw,
      });
      if (signInErr) { toast.error("Contraseña actual incorrecta"); return; }

      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      toast.success("Contraseña actualizada");
      setPwOpen(false);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cambiar contraseña");
    } finally {
      setPwSaving(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-900 flex items-center justify-center">
          <Wallet size={28} className="text-white" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Inicia sesión para ver tu perfil</h2>
        <p className="text-sm text-gray-400">Gestiona tu cartera y revisa tu historial.</p>
        <button
          onClick={() => setAuthOpen(true)}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
        >
          <LogIn size={16} />
          Iniciar sesión
        </button>
        <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      </div>
    );
  }

  const pendingBets = bets.filter((b: any) => b.status === "pending").length;
  const wonBets     = bets.filter((b: any) => b.status === "won").length;
  const totalBet    = bets.reduce((s: number, b: any) => s + (b.amount ?? 0), 0);
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("es-MX", { month: "long", year: "numeric" })
    : null;

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* ── Cabecera de perfil ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">

        {/* Vista normal */}
        {!editing ? (
          <div className="flex items-center gap-4">
            {(() => {
              const c = AVATAR_COLORS.find((a) => a.id === (profile?.avatar_color ?? "violet")) ?? AVATAR_COLORS[0];
              return profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.username}
                  className="w-14 h-14 rounded-2xl object-cover shrink-0 border border-gray-200"
                />
              ) : (
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${c.gradient} flex items-center justify-center text-white text-xl font-bold shrink-0`}>
                  {profile?.username?.slice(0, 2).toUpperCase() ?? "?"}
                </div>
              );
            })()}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-gray-900 truncate">{profile?.username}</h1>
              <p className="text-sm text-gray-400 truncate">{user?.email}</p>
              {profile?.bio && (
                <p className="text-[12px] text-gray-500 mt-0.5 line-clamp-2">{profile.bio}</p>
              )}
              {memberSince && (
                <p className="text-[11px] text-gray-300 mt-0.5">Miembro desde {memberSince}</p>
              )}
            </div>
            <button
              onClick={startEdit}
              className="shrink-0 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <Pencil size={15} />
            </button>
          </div>
        ) : (
          /* Modo edición */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-900">Editar perfil</p>
              <button onClick={cancelEdit} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={15} />
              </button>
            </div>

            {/* Foto de perfil */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Foto de perfil</p>
              <div className="flex items-center gap-3">
                {/* Preview */}
                {(() => {
                  const c = AVATAR_COLORS.find((a) => a.id === editColor) ?? AVATAR_COLORS[0];
                  return profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="avatar"
                      className="w-12 h-12 rounded-xl object-cover border border-gray-200 shrink-0"
                    />
                  ) : (
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.gradient} flex items-center justify-center text-white text-lg font-bold shrink-0`}>
                      {editUsername.slice(0, 2).toUpperCase() || "?"}
                    </div>
                  );
                })()}
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {uploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                    {uploading ? "Subiendo..." : "Subir foto"}
                  </button>
                  {profile?.avatar_url && (
                    <button
                      type="button"
                      onClick={removeAvatar}
                      disabled={uploading}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-rose-500 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={12} />
                      Quitar foto
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </div>
            </div>

            {/* Selector de color de avatar */}
            {!profile?.avatar_url && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Color de avatar</p>
                <div className="flex gap-2 flex-wrap">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setEditColor(c.id)}
                      className={`w-8 h-8 rounded-xl bg-gradient-to-br ${c.gradient} transition-all ${editColor === c.id ? `ring-2 ring-offset-2 ${c.ring}` : "opacity-60 hover:opacity-100"}`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Nombre de usuario</label>
              <input
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                maxLength={30}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-400 transition-colors"
              />
            </div>

            {/* Bio */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Bio <span className="normal-case font-normal">(opcional)</span></label>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                maxLength={120}
                rows={2}
                placeholder="Cuéntanos algo sobre ti..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 resize-none focus:outline-none focus:border-blue-400 transition-colors"
              />
              <p className="text-[10px] text-gray-400 text-right">{editBio.length}/120</p>
            </div>

            {/* Acciones */}
            <div className="flex gap-2">
              <button
                onClick={cancelEdit}
                className="flex-1 py-2 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                disabled={saving || !editUsername.trim()}
                className="flex-1 py-2 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Guardar
              </button>
            </div>
          </div>
        )}

        {/* Cambiar contraseña */}
        {!editing && (
          <div className="pt-3 border-t border-gray-100">
            {!pwOpen ? (
              <button
                onClick={() => setPwOpen(true)}
                className="flex items-center gap-2 text-[12px] font-semibold text-gray-400 hover:text-gray-700 transition-colors"
              >
                <Lock size={13} />
                Cambiar contraseña
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-bold text-gray-700 flex items-center gap-1.5"><Lock size={13} /> Cambiar contraseña</p>
                  <button onClick={() => { setPwOpen(false); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }} className="text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                </div>
                {[
                  { label: "Contraseña actual", val: currentPw, set: setCurrentPw },
                  { label: "Nueva contraseña",  val: newPw,     set: setNewPw     },
                  { label: "Confirmar nueva",   val: confirmPw, set: setConfirmPw },
                ].map(({ label, val, set }, i) => (
                  <div key={label} className="relative">
                    <input
                      type={showPws[i] ? "text" : "password"}
                      placeholder={label}
                      value={val}
                      onChange={(e) => set(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 pr-10 text-sm text-gray-900 focus:outline-none focus:border-blue-400 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPws(s => s.map((v, j) => j === i ? !v : v))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPws[i] ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                ))}
                <button
                  onClick={savePassword}
                  disabled={pwSaving || !currentPw || !newPw || !confirmPw}
                  className="w-full py-2 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                >
                  {pwSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                  Actualizar contraseña
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Cartera ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Cartera</p>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-3xl font-bold text-gray-900 tabular-nums leading-none">
              ${fmt(balance)}
            </p>
            <p className="text-sm text-gray-400 mt-1">MXN disponible</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setWithdrawOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
            >
              <ArrowUpCircle size={15} />
              Retirar
            </button>
            <button
              onClick={() => setDepositOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              <Plus size={15} />
              Depositar
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Invertido",     value: `$${fmt(totalBet)}`, icon: Target,    color: "text-blue-600"    },
          { label: "En curso",      value: pendingBets,          icon: TrendingUp, color: "text-amber-500"   },
          { label: "Acertadas",     value: wonBets,              icon: Trophy,     color: "text-emerald-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-2xl p-4">
            <Icon size={16} className={`${color} mb-2`} />
            <p className="text-xl font-bold text-gray-900 tabular-nums">{value}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Historial de transacciones ── */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-gray-100 space-y-3">
          <p className="text-[13px] font-bold text-gray-900">Historial</p>
          {/* Filtros */}
          <div className="flex gap-1.5 flex-wrap">
            {([
              { key: "all",     label: "Todos"      },
              { key: "deposit", label: "Depósitos"  },
              { key: "win",     label: "Premios"     },
              { key: "bet",     label: "Apuestas"   },
            ] as const).map(({ key, label }) => {
              const count = key === "all"
                ? transactions.length
                : transactions.filter((t) => t.type === key).length;
              return (
                <button
                  key={key}
                  onClick={() => setTxFilter(key)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-[12px] font-semibold transition-colors ${
                    txFilter === key
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {label}
                  <span className={`text-[10px] ${txFilter === key ? "text-gray-300" : "text-gray-400"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {txLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={22} className="animate-spin text-gray-300" />
          </div>
        ) : (() => {
          const filtered = txFilter === "all"
            ? transactions
            : transactions.filter((t) => t.type === txFilter);
          return filtered.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-gray-400">
                {txFilter === "all" ? "Sin movimientos aún." : `Sin ${TX_CONFIG[txFilter]?.label.toLowerCase() ?? txFilter} aún.`}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 px-5">
              {filtered.map((tx) => <TxRow key={tx.id} tx={tx} />)}
            </div>
          );
        })()}
      </div>

      {/* ── Mis retiros ── */}
      {(wdLoading || withdrawals.length > 0) && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 pt-4 pb-2 border-b border-gray-100 flex items-center justify-between">
            <p className="text-[13px] font-bold text-gray-900">Mis retiros</p>
            {withdrawals.filter((w) => w.status === "pending").length > 0 && (
              <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                {withdrawals.filter((w) => w.status === "pending").length} pendiente{withdrawals.filter((w) => w.status === "pending").length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          {wdLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-gray-300" />
            </div>
          ) : (
            <div className="divide-y divide-gray-100 px-5">
              {withdrawals.map((w) => <WithdrawalRow key={w.id} w={w} />)}
            </div>
          )}
        </div>
      )}

      <DepositModal  open={depositOpen}  onOpenChange={setDepositOpen}  />
      <WithdrawModal open={withdrawOpen} onOpenChange={setWithdrawOpen} />
    </div>
  );
}
