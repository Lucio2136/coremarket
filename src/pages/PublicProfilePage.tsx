import { useParams, Link, useNavigate } from "react-router-dom";
import { usePublicProfile } from "@/hooks/use-public-profile";
import { motion } from "framer-motion";
import { ArrowLeft, Trophy, TrendingUp, BarChart2, CheckCircle, XCircle, Clock, AlertCircle, Loader2 } from "lucide-react";

const GRADIENTS: Record<string, string> = {
  violet: "from-violet-500 to-pink-500",
  blue:   "from-blue-500 to-cyan-400",
  green:  "from-emerald-500 to-teal-400",
  orange: "from-orange-400 to-amber-300",
  rose:   "from-rose-500 to-pink-400",
  indigo: "from-indigo-500 to-violet-400",
};

function fmt(n: number) {
  return (n ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_CFG = {
  won:     { label: "Ganó",      icon: CheckCircle, cls: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  lost:    { label: "Perdió",    icon: XCircle,     cls: "text-rose-500 bg-rose-50 border-rose-200"          },
  pending: { label: "Pendiente", icon: Clock,        cls: "text-amber-600 bg-amber-50 border-amber-200"       },
};

export default function PublicProfilePage() {
  const { username }                  = useParams<{ username: string }>();
  const { profile, bets, loading, error } = usePublicProfile(username);
  const navigate                      = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <AlertCircle size={40} className="text-gray-300" />
        <p className="text-base font-semibold text-gray-700">Usuario no encontrado</p>
        <p className="text-sm text-gray-400">El perfil <strong>@{username}</strong> no existe.</p>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft size={14} /> Volver
        </button>
      </div>
    );
  }

  const gradient = GRADIENTS[profile.avatar_color ?? "violet"] ?? GRADIENTS.violet;
  const winRate  = bets.length > 0
    ? Math.round((bets.filter((b) => b.status === "won").length / bets.filter((b) => b.status !== "pending").length) * 100) || 0
    : 0;

  return (
    <div className="max-w-xl mx-auto space-y-5 pb-8">

      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        <ArrowLeft size={14} /> Volver
      </button>

      {/* ── Card de perfil ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-gray-800 rounded-2xl p-6"
      >
        <div className="flex items-center gap-4">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.username}
              className="w-16 h-16 rounded-full object-cover border-2 border-white shadow"
            />
          ) : (
            <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-xl font-bold shadow`}>
              {profile.username.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-none">
              @{profile.username}
            </h1>
            <p className="text-[12px] text-gray-400 mt-1">
              Miembro desde {fmtDate(profile.created_at)}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          {[
            { icon: Trophy,    label: "Ganado",      value: `$${fmt(profile.total_won)}`, color: "text-emerald-600" },
            { icon: BarChart2, label: "Invertido",   value: `$${fmt(profile.total_bet)}`, color: "text-blue-600"    },
            { icon: TrendingUp, label: "Tasa acierto", value: `${winRate}%`,              color: "text-violet-600"  },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-gray-800 text-center">
              <Icon size={14} className={color} />
              <p className="text-[15px] font-bold text-gray-900 dark:text-gray-100 tabular-nums leading-none">
                {value}
              </p>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest leading-none">{label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Predicciones recientes ── */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Predicciones recientes
        </p>

        {bets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center border border-gray-200 dark:border-gray-800 rounded-2xl bg-white dark:bg-[#0d1117]">
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">Sin predicciones aún</p>
            <p className="text-xs text-gray-400">Este usuario no ha apostado todavía.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {bets.map((bet, i) => {
              const cfg  = STATUS_CFG[bet.status];
              const Icon = cfg.icon;
              return (
                <motion.div
                  key={bet.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 flex items-start gap-3"
                >
                  <div className={`mt-0.5 shrink-0 w-6 h-6 rounded-full flex items-center justify-center border ${cfg.cls}`}>
                    <Icon size={12} strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold text-gray-800 dark:text-gray-200 leading-snug line-clamp-2">
                      {bet.markets?.title ?? "Mercado eliminado"}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-[10.5px] font-bold px-1.5 py-0.5 rounded-full border ${bet.side === "yes" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-600 border-rose-200"}`}>
                        {bet.side === "yes" ? "Sí" : "No"}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        ${fmt(bet.amount)} MXN
                      </span>
                      {bet.status === "won" && (
                        <span className="text-[11px] font-bold text-emerald-600">
                          +${fmt(bet.potential_payout)}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-[10.5px] text-gray-400 shrink-0 mt-0.5">{fmtDate(bet.created_at)}</p>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
