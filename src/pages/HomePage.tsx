import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertCircle, RefreshCw, TrendingUp, DollarSign, CheckCircle, ChevronDown, ChevronUp, Lightbulb } from "lucide-react";
import { MarketCard } from "@/components/MarketCard";
import { NewsPanel } from "@/components/NewsPanel";
import { PricesWidget } from "@/components/PricesWidget";
import { LeaderboardWidget } from "@/components/LeaderboardWidget";
import { FeaturedSection } from "@/components/FeaturedSection";
import { LiveFeedWidget } from "@/components/LiveFeedWidget";
import { useMarkets } from "@/hooks/use-markets";
import { useUserPositions } from "@/hooks/use-user-positions";
import { useSavedMarkets } from "@/hooks/use-saved-markets";
import { Button } from "@/components/ui/button";

// ─── Sección informativa ────────────────────────────────────────────────────

const HOW_STEPS = [
  {
    icon: TrendingUp,
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    title: "Elige un mercado",
    desc: "Selecciona un evento: política, deportes, entretenimiento. Cada mercado es una pregunta con respuesta Sí o No.",
  },
  {
    icon: DollarSign,
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    title: "Toma una posición",
    desc: "Compra Sí o No con pesos MXN. El precio refleja la probabilidad: 65% significa que el mercado cree que hay 65% de chance que ocurra.",
  },
  {
    icon: CheckCircle,
    color: "text-violet-600",
    bg: "bg-violet-50 dark:bg-violet-950/30",
    title: "Cobra si aciertas",
    desc: "Cuando el evento se resuelve, los ganadores reparten el pozo completo proporcionalmente. Cuanto más temprano entres, mejor precio obtienes.",
  },
];

const FAQS = [
  {
    q: "¿Cómo se determina el precio (50%, 65%...)?",
    a: "El precio lo fija el mercado. Cuando más gente toma posición Sí, ese precio sube. Es la sabiduría colectiva en tiempo real — igual que una bolsa de valores, pero de predicciones.",
  },
  {
    q: "¿Qué pasa si el mercado se cierra sin resolución?",
    a: "Si el evento no se puede verificar, el mercado se cancela y recibes tu inversión de vuelta íntegra. Nunca pierdes por causas ajenas al resultado.",
  },
  {
    q: "¿Cuál es la ganancia máxima posible?",
    a: "Depende del precio al que entraste. Si compraste Sí a $0.30 (30%) y ganas, recibes ~$3.33 por cada $1 invertido. Menor probabilidad = mayor pago si aciertas.",
  },
  {
    q: "¿Hay comisión?",
    a: "Lucebase retiene un 2% del pozo ganador como fee de plataforma. El 98% restante se reparte entre los ganadores.",
  },
];

function HowItWorks() {
  const [open, setOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden bg-white dark:bg-[#0d1117]">
      {/* Header toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
            <Lightbulb size={13} className="text-amber-500" />
          </div>
          <span className="text-[13.5px] font-semibold text-slate-800 dark:text-gray-200">
            ¿Cómo funciona Lucebase?
          </span>
          <span className="text-[11px] font-medium text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
            Mercados de predicción
          </span>
        </div>
        {open
          ? <ChevronUp size={15} className="text-gray-400 shrink-0" />
          : <ChevronDown size={15} className="text-gray-400 shrink-0" />
        }
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-6 border-t border-gray-100 dark:border-gray-800 pt-5">

          {/* Pasos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {HOW_STEPS.map((step, i) => (
              <div key={i} className="flex flex-col gap-2.5 p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-gray-100 dark:border-gray-800">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${step.bg} shrink-0`}>
                  <step.icon size={15} className={step.color} />
                </div>
                <div>
                  <p className="text-[12.5px] font-semibold text-slate-900 dark:text-gray-100 mb-1">
                    <span className="text-gray-400 mr-1.5 font-normal tabular-nums">{i + 1}.</span>
                    {step.title}
                  </p>
                  <p className="text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* FAQs */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Preguntas frecuentes</p>
            {FAQS.map((faq, i) => (
              <div key={i} className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-[12.5px] font-medium text-slate-800 dark:text-gray-200 pr-4">{faq.q}</span>
                  {openFaq === i
                    ? <ChevronUp size={13} className="text-gray-400 shrink-0" />
                    : <ChevronDown size={13} className="text-gray-400 shrink-0" />
                  }
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-3 text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed border-t border-gray-100 dark:border-gray-800 pt-2.5">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MarketCardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-2xl p-4 animate-pulse ${className}`}>
      <div className="flex items-start gap-4 mb-3">
        <div className="w-9 h-9 rounded-xl bg-gray-100 shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-2.5 bg-gray-100 rounded-full w-2/3" />
          <div className="h-2.5 bg-gray-100 rounded-full w-full" />
          <div className="h-2.5 bg-gray-100 rounded-full w-4/5" />
        </div>
      </div>
      <div className="space-y-2 mt-3">
        <div className="h-8 bg-gray-100 rounded-xl" />
        <div className="h-8 bg-gray-100 rounded-xl" />
      </div>
      <div className="h-px bg-gray-100 mt-3" />
      <div className="flex gap-4 mt-2.5">
        <div className="h-3 w-14 bg-gray-100 rounded-full" />
        <div className="h-3 w-10 bg-gray-100 rounded-full" />
      </div>
    </div>
  );
}

export default function HomePage() {
  const { markets, loading, error, refetch } = useMarkets();
  const userPositions = useUserPositions();
  const { saved, isSaved, toggleSave } = useSavedMarkets();
  const [searchParams] = useSearchParams();

  const cat = searchParams.get("cat") ?? "";
  const q   = searchParams.get("q")?.toLowerCase() ?? "";

  const filtered = useMemo(() => {
    const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return markets.filter((m) => {
      if (cat === "saved")    return saved.has(m.id);
      if (cat === "trending") return m.is_trending;
      if (cat === "new")      return true;
      if (cat === "hot")      return (m.bettor_count ?? 0) > 5;
      if (cat === "closing")  return m.closes_at != null && new Date(m.closes_at) < in24h;
      if (cat)                return m.category?.toLowerCase() === cat.toLowerCase();
      if (q)                  return (
        m.title.toLowerCase().includes(q) ||
        m.subject_name.toLowerCase().includes(q) ||
        m.category?.toLowerCase().includes(q)
      );
      return true;
    });
  }, [markets, cat, q, saved]);

  const label = cat === "saved" ? "Guardados"
    : cat === "trending" ? "Tendencia"
    : cat === "new" ? "Nuevo"
    : cat === "hot" ? "Popular"
    : cat === "closing" ? "Cierra pronto"
    : cat ? cat
    : q ? `"${q}"`
    : "Todos los mercados";

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <AlertCircle size={48} className="text-red-400 opacity-60" />
        <h2 className="font-bold text-xl text-gray-800">Error cargando mercados</h2>
        <p className="text-sm text-gray-500">{error}</p>
        <Button onClick={refetch} variant="outline" className="gap-2">
          <RefreshCw size={16} />
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">

    {/* ── Hero / Featured (sin filtros activos) ── */}
    {!loading && markets.length > 0 && !cat && !q && (
      <FeaturedSection markets={markets} />
    )}

    <div className="flex gap-7 items-start">
      {/* ── Columna principal ── */}
      <div className="flex-1 min-w-0 space-y-4">
      {/* Cabecera de sección */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-bold text-slate-900 dark:text-gray-100" style={{ letterSpacing: "-0.01em" }}>{label}</h2>
          {!loading && filtered.length > 0 && (
            <span className="text-[11px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {filtered.length}
            </span>
          )}
        </div>
        {!loading && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-500/10 border border-red-200/70 dark:border-red-500/20 text-[11px] font-semibold text-red-600 dark:text-red-400">
            <span className="relative flex w-2 h-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-70" />
              <span className="relative inline-flex rounded-full w-2 h-2 bg-red-500" />
            </span>
            En vivo
          </span>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-5 items-stretch">
          {Array.from({ length: 9 }).map((_, i) => (
            <MarketCardSkeleton
              key={i}
              className={
                i >= 6 ? "hidden lg:block" :
                i >= 4 ? "hidden sm:block" :
                ""
              }
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="text-4xl">{cat === "saved" ? "🔖" : "📭"}</div>
          <p className="text-base font-semibold text-gray-700">
            {cat === "saved" ? "Aún no guardas ningún mercado" : "Sin mercados aquí"}
          </p>
          <p className="text-sm text-gray-400">
            {cat === "saved"
              ? "Toca el ícono de marcador en una card para guardarlo aquí."
              : "Prueba otra categoría o espera a que se creen nuevos mercados."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-5 items-stretch">
          {filtered.map((market, i) => (
            <MarketCard
              key={market.id}
              market={market}
              index={i}
              userPosition={userPositions.get(market.id) ?? null}
              isSaved={isSaved(market.id)}
              onToggleSave={toggleSave}
            />
          ))}
        </div>
      )}
      </div>{/* fin columna principal */}

      {/* ── Sidebar derecha (solo desktop xl+) ── */}
      <div className="hidden xl:flex flex-col gap-4" style={{ width: 260, flexShrink: 0, position: "sticky", top: 80, alignSelf: "flex-start" }}>
        <PricesWidget />
        {/* <LiveFeedWidget /> */}
        <LeaderboardWidget />
        <NewsPanel />
      </div>
    </div>
    </div>
  );
}
