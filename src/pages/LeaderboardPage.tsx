import { useLeaderboard } from "@/hooks/use-leaderboard";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";
import { Trophy, Loader2, AlertCircle } from "lucide-react";

const AVATAR_GRADIENTS: Record<string, string> = {
  violet: "from-violet-500 to-pink-500",
  blue:   "from-blue-500 to-cyan-400",
  green:  "from-emerald-500 to-teal-400",
  orange: "from-orange-400 to-amber-300",
  rose:   "from-rose-500 to-pink-400",
  indigo: "from-indigo-500 to-violet-400",
};

function fmt(n: number) {
  return n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const MEDAL = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const { entries, loading, error } = useLeaderboard(50);
  const { user } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center">
        <AlertCircle size={40} className="text-red-300" />
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  const topThree = entries.slice(0, 3);
  const rest     = entries.slice(3);

  return (
    <>
    <SEOHead
      title="Tabla de Líderes"
      description="Los mejores predictores de Lucebase. Ranking de usuarios con más ganancias en mercados de predicción con pesos mexicanos."
      url="/leaderboard"
    />
    <div className="max-w-xl mx-auto space-y-5">

      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <Trophy size={22} className="text-amber-500" />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Leaderboard</h1>
          <p className="text-sm text-gray-400">Top predictores por ganancias totales</p>
        </div>
      </div>

      {/* Podio top 3 */}
      {topThree.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {topThree.map((entry, i) => {
            const gradient = AVATAR_GRADIENTS[entry.avatar_color ?? "violet"] ?? AVATAR_GRADIENTS.violet;
            const isMe = entry.id === user?.id;
            return (
              <Link
                key={entry.id}
                to={`/user/${entry.username}`}
                className={`flex flex-col items-center gap-2 p-3 rounded-2xl border text-center transition-opacity hover:opacity-80 ${
                  i === 0
                    ? "bg-amber-50 border-amber-200"
                    : i === 1
                    ? "bg-gray-50 border-gray-200"
                    : "bg-orange-50 border-orange-200"
                } ${isMe ? "ring-2 ring-blue-400" : ""}`}
              >
                <span className="text-2xl">{MEDAL[i]}</span>
                {entry.avatar_url ? (
                  <img
                    src={entry.avatar_url}
                    alt={entry.username}
                    className="w-12 h-12 rounded-full object-cover border-2 border-white shadow"
                  />
                ) : (
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-base font-bold shadow`}>
                    {entry.username?.slice(0, 2).toUpperCase() ?? "?"}
                  </div>
                )}
                <p className="text-[12px] font-bold text-gray-900 truncate w-full">{entry.username}</p>
                <p className="text-[13px] font-bold text-emerald-600 tabular-nums">${fmt(entry.total_won)}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">MXN ganados</p>
              </Link>
            );
          })}
        </div>
      )}

      {/* Lista del 4to en adelante */}
      {rest.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="divide-y divide-gray-100">
            {rest.map((entry, i) => {
              const rank = i + 4;
              const gradient = AVATAR_GRADIENTS[entry.avatar_color ?? "violet"] ?? AVATAR_GRADIENTS.violet;
              const isMe = entry.id === user?.id;
              return (
                <Link
                  key={entry.id}
                  to={`/user/${entry.username}`}
                  className={`flex items-center gap-3 px-4 py-3 ${isMe ? "bg-blue-50" : "hover:bg-gray-50"} transition-colors`}
                >
                  <span className="text-[13px] font-bold text-gray-400 tabular-nums w-6 text-center shrink-0">
                    {rank}
                  </span>
                  {entry.avatar_url ? (
                    <img
                      src={entry.avatar_url}
                      alt={entry.username}
                      className="w-8 h-8 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                      {entry.username?.slice(0, 2).toUpperCase() ?? "?"}
                    </div>
                  )}
                  <p className={`flex-1 text-[13px] font-semibold truncate ${isMe ? "text-blue-700" : "text-gray-900"}`}>
                    {entry.username}
                    {isMe && <span className="ml-1.5 text-[10px] font-bold text-blue-500 bg-blue-100 px-1.5 py-0.5 rounded-full">Tú</span>}
                  </p>
                  <p className="text-[13px] font-bold text-emerald-600 tabular-nums shrink-0">
                    ${fmt(entry.total_won)}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
          <Trophy size={40} className="text-gray-200" />
          <p className="text-base font-semibold text-gray-700">Aún no hay ganadores</p>
          <p className="text-sm text-gray-400">¡Sé el primero en acertar una predicción!</p>
        </div>
      )}
    </div>
    </>
  );
}
