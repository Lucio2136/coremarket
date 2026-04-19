import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Search, ChevronDown, ChevronRight,
  Rocket, BarChart2, CreditCard, User,
  TrendingUp, ShieldCheck, HelpCircle, Mail,
  BookOpen, Zap, Trophy, ArrowRight,
} from "lucide-react";

// ─── Contenido ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  {
    id: "inicio",
    icon: Rocket,
    color: "text-violet-600",
    bg: "bg-violet-50 dark:bg-violet-950/30",
    border: "border-violet-200/60 dark:border-violet-800/40",
    label: "Empezar",
    desc: "Cuenta nueva, depósitos iniciales y primeros pasos.",
    articles: [
      {
        q: "¿Qué es Lucebase?",
        a: "Lucebase es una plataforma de mercados de predicción en español. Apuestas sobre si ocurrirá o no un evento real — política, deportes, entretenimiento — usando pesos mexicanos. Si aciertas, cobras una parte del pozo total.",
      },
      {
        q: "¿Cómo creo una cuenta?",
        a: "Haz clic en «Entrar» en la esquina superior derecha, luego selecciona «Registrarse». Ingresa tu correo, elige un nombre de usuario y contraseña. Recibirás $0 MXN de saldo inicial que se acreditará al verificar tu cuenta.",
      },
      {
        q: "¿Es gratis registrarse?",
        a: "Sí, crear una cuenta en Lucebase es completamente gratuito. Solo necesitas una dirección de correo electrónico válida.",
      },
      {
        q: "¿Cómo funciona el programa de referidos?",
        a: "Comparte tu código de referido desde el ícono de regalo en el header. Cuando un amigo se registre con tu código, ambos reciben $50 MXN de bono directo a su saldo.",
      },
    ],
  },
  {
    id: "mercados",
    icon: BarChart2,
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200/60 dark:border-blue-800/40",
    label: "Mercados",
    desc: "Cómo funcionan los precios, tipos de mercado y resolución.",
    articles: [
      {
        q: "¿Cómo se determina el precio (50%, 65%...)?",
        a: "El precio lo fija el mercado automáticamente. Cuando más personas compran «Sí», ese precio sube. Es la sabiduría colectiva en tiempo real — igual que una bolsa de valores, pero de predicciones. Nadie fija el precio manualmente.",
      },
      {
        q: "¿Qué tipos de mercado existen?",
        a: "Hay tres tipos: Binario (Sí o No), Múltiple opción (varios candidatos o resultados posibles) y Scalar (predices un valor numérico dentro de un rango, como el precio de algo o cuántos puntos anotará un jugador).",
      },
      {
        q: "¿Qué pasa si el mercado se cierra sin resolución?",
        a: "Si el evento no puede verificarse con fuentes públicas, el mercado se cancela y recibes tu inversión de vuelta íntegra. Nunca perderás dinero por causas ajenas al resultado del evento.",
      },
      {
        q: "¿Quién resuelve los mercados?",
        a: "El equipo de Lucebase verifica el resultado usando fuentes públicas verificables (noticias, estadísticas oficiales, declaraciones). Una vez confirmado, el sistema acredita los pagos automáticamente.",
      },
      {
        q: "¿Puedo vender mi posición antes de que cierre el mercado?",
        a: "Actualmente las posiciones se mantienen hasta la resolución. Estamos trabajando en una función de venta anticipada para futuras versiones.",
      },
    ],
  },
  {
    id: "predicciones",
    icon: TrendingUp,
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200/60 dark:border-emerald-800/40",
    label: "Predicciones",
    desc: "Cómo apostar, calcular ganancias y entender tus posiciones.",
    articles: [
      {
        q: "¿Cuál es la apuesta mínima?",
        a: "El monto mínimo por predicción es de $10 MXN. No hay máximo establecido, pero depende de tu saldo disponible.",
      },
      {
        q: "¿Cuál es la ganancia máxima posible?",
        a: "Depende del precio al que entraste. Si compraste «Sí» a $0.20 (20%) y ganas, recibes ~$5 por cada $1 invertido. Menor probabilidad = mayor pago si aciertas. La fórmula es: ganancia = monto ÷ odds.",
      },
      {
        q: "¿Cuándo cobro si gano?",
        a: "Una vez que el mercado se resuelve, el pago se acredita automáticamente a tu saldo en cuestión de minutos. Recibirás una notificación dentro de la app.",
      },
      {
        q: "¿Qué significa el badge «Tú» en el botón Sí/No?",
        a: "Ese badge aparece cuando ya tienes una posición activa en ese lado del mercado. Te indica visualmente dónde está tu dinero sin necesidad de abrir el mercado.",
      },
    ],
  },
  {
    id: "pagos",
    icon: CreditCard,
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200/60 dark:border-amber-800/40",
    label: "Pagos y saldo",
    desc: "Depósitos, retiros, comisiones y Stripe.",
    articles: [
      {
        q: "¿Cómo deposito dinero?",
        a: "Haz clic en «Depósito» en el header. Ingresa el monto y los datos de tu tarjeta de crédito o débito. Los pagos se procesan de forma segura a través de Stripe. En modo prueba usa: 4242 4242 4242 4242 / 12/28 / 123.",
      },
      {
        q: "¿Cómo retiro mi saldo?",
        a: "Ve a tu perfil (clic en tu avatar > Retirar) e ingresa el monto y datos bancarios. Los retiros se procesan manualmente en 1–3 días hábiles.",
      },
      {
        q: "¿Hay comisión?",
        a: "Lucebase retiene un 3% del pago bruto como fee de plataforma. El resto se acredita íntegro al ganador. No hay comisiones por depósito ni retiro.",
      },
      {
        q: "¿Es seguro ingresar mi tarjeta?",
        a: "Sí. Todos los pagos se procesan a través de Stripe, uno de los procesadores de pago más seguros del mundo. Lucebase nunca almacena los datos de tu tarjeta.",
      },
    ],
  },
  {
    id: "cuenta",
    icon: User,
    color: "text-rose-600",
    bg: "bg-rose-50 dark:bg-rose-950/30",
    border: "border-rose-200/60 dark:border-rose-800/40",
    label: "Mi cuenta",
    desc: "Perfil, avatar, seguridad y configuración.",
    articles: [
      {
        q: "¿Cómo cambio mi foto de perfil?",
        a: "Ve a «Mi perfil» desde el menú de tu avatar. Puedes subir una foto personalizada o elegir entre los avatares de colores disponibles.",
      },
      {
        q: "¿Cómo cambio mi contraseña?",
        a: "Desde la pantalla de inicio de sesión puedes usar «¿Olvidaste tu contraseña?» para recibir un correo de restablecimiento. Dentro de la app, la función estará disponible próximamente.",
      },
      {
        q: "¿Qué es el Leaderboard?",
        a: "El Leaderboard es el ranking de los mejores predictores de Lucebase. Se actualiza en tiempo real y muestra ganancias totales, racha activa y estadísticas de acierto.",
      },
      {
        q: "¿Cómo cierro sesión?",
        a: "Haz clic en tu avatar en la esquina superior derecha y selecciona «Cerrar sesión» al final del menú.",
      },
    ],
  },
  {
    id: "seguridad",
    icon: ShieldCheck,
    color: "text-cyan-600",
    bg: "bg-cyan-50 dark:bg-cyan-950/30",
    border: "border-cyan-200/60 dark:border-cyan-800/40",
    label: "Seguridad",
    desc: "Privacidad, datos personales y uso responsable.",
    articles: [
      {
        q: "¿Cómo protege Lucebase mis datos?",
        a: "Usamos Supabase con Row Level Security (RLS) para que solo tú puedas acceder a tus datos. Las contraseñas se encriptan con bcrypt y los pagos se procesan a través de Stripe sin que almacenemos datos de tarjeta.",
      },
      {
        q: "¿Lucebase comparte mis datos con terceros?",
        a: "No vendemos ni compartimos datos personales. Solo usamos proveedores de confianza (Stripe para pagos, Supabase para base de datos) que tienen sus propias políticas de privacidad.",
      },
      {
        q: "¿Qué pasa si detecto actividad sospechosa en mi cuenta?",
        a: "Contáctanos de inmediato a contacto@lucebase.mx. Bloquearemos tu cuenta preventivamente y revisaremos la actividad. Te recomendamos cambiar tu contraseña desde otro dispositivo.",
      },
    ],
  },
];

// ─── Artículos destacados ────────────────────────────────────────────────────

const FEATURED = [
  { icon: Zap,      label: "Guía rápida para comenzar",   catId: "inicio"       },
  { icon: BookOpen, label: "Entender los tipos de mercado", catId: "mercados"    },
  { icon: Trophy,   label: "Cómo maximizar tus ganancias",  catId: "predicciones"},
  { icon: CreditCard, label: "Depositar y retirar fondos",  catId: "pagos"       },
];

// ─── Componente ──────────────────────────────────────────────────────────────

export default function HelpPage() {
  const [query, setQuery]           = useState("");
  const [openCat, setOpenCat]       = useState<string | null>(null);
  const [openArt, setOpenArt]       = useState<string | null>(null);

  // Búsqueda global en todas las categorías
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const results: { catLabel: string; q: string; a: string; key: string }[] = [];
    for (const cat of CATEGORIES) {
      for (const art of cat.articles) {
        if (art.q.toLowerCase().includes(q) || art.a.toLowerCase().includes(q)) {
          results.push({ catLabel: cat.label, q: art.q, a: art.a, key: `${cat.id}-${art.q}` });
        }
      }
    }
    return results;
  }, [query]);

  const toggleCat = (id: string) => {
    setOpenCat((prev) => (prev === id ? null : id));
    setOpenArt(null);
  };
  const toggleArt = (key: string) => setOpenArt((prev) => (prev === key ? null : key));

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">

      {/* ── Hero ── */}
      <div className="relative rounded-2xl overflow-hidden bg-gray-900 dark:bg-gray-950 px-6 py-10 sm:px-10">
        {/* Dot grid background */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        {/* Glow */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-violet-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
              <HelpCircle size={13} className="text-white/80" />
            </div>
            <span className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">Centro de ayuda</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-1" style={{ letterSpacing: "-0.025em" }}>
            ¿En qué podemos ayudarte?
          </h1>
          <p className="text-[13px] text-white/50 mb-6">Busca una pregunta o explora por categorías.</p>

          {/* Search */}
          <div className="relative max-w-lg">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ej: ¿cómo deposito?, comisiones, retiro..."
              className="w-full bg-white/10 border border-white/15 text-white placeholder:text-white/30 rounded-xl pl-10 pr-4 py-2.5 text-[13.5px] focus:outline-none focus:bg-white/15 focus:border-white/30 transition-all"
            />
          </div>
        </div>
      </div>

      {/* ── Resultados de búsqueda ── */}
      <AnimatePresence>
        {searchResults !== null && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="space-y-2"
          >
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
              {searchResults.length === 0
                ? "Sin resultados"
                : `${searchResults.length} resultado${searchResults.length !== 1 ? "s" : ""}`}
            </p>
            {searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-center border border-gray-200 dark:border-gray-800 rounded-2xl bg-white dark:bg-white/[0.02]">
                <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">No encontramos esa pregunta</p>
                <p className="text-xs text-gray-400">Intenta con otras palabras o contáctanos directamente.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {searchResults.map((r) => (
                  <SearchResultItem key={r.key} result={r} />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Solo muestra el contenido normal cuando no hay búsqueda ── */}
      {searchResults === null && (
        <>
          {/* ── Artículos destacados ── */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Guías populares</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {FEATURED.map((f) => {
                const cat = CATEGORIES.find((c) => c.id === f.catId)!;
                return (
                  <button
                    key={f.label}
                    onClick={() => { setOpenCat(f.catId); setTimeout(() => document.getElementById(`cat-${f.catId}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }}
                    className="flex flex-col items-start gap-2.5 p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.02] hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm transition-all text-left group"
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${cat.bg}`}>
                      <f.icon size={13} className={cat.color} />
                    </div>
                    <span className="text-[12px] font-semibold text-gray-700 dark:text-gray-200 leading-snug group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                      {f.label}
                    </span>
                    <ArrowRight size={11} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors mt-auto" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Categorías ── */}
          <div className="space-y-2.5">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Todas las categorías</p>
            {CATEGORIES.map((cat) => (
              <div
                key={cat.id}
                id={`cat-${cat.id}`}
                className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden bg-white dark:bg-[#0d1117]"
              >
                {/* Header de categoría */}
                <button
                  onClick={() => toggleCat(cat.id)}
                  className="w-full flex items-center gap-3.5 px-5 py-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${cat.bg} border ${cat.border}`}>
                    <cat.icon size={15} className={cat.color} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-[13.5px] font-bold text-gray-900 dark:text-gray-100 leading-none">{cat.label}</p>
                    <p className="text-[11.5px] text-gray-400 dark:text-gray-500 mt-0.5 leading-none">{cat.desc}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-medium text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                      {cat.articles.length}
                    </span>
                    <motion.div
                      animate={{ rotate: openCat === cat.id ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown size={15} className="text-gray-400" />
                    </motion.div>
                  </div>
                </button>

                {/* Artículos de la categoría */}
                <AnimatePresence initial={false}>
                  {openCat === cat.id && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-gray-100 dark:border-gray-800 divide-y divide-gray-50 dark:divide-gray-800/60">
                        {cat.articles.map((art) => {
                          const key = `${cat.id}-${art.q}`;
                          return (
                            <div key={key}>
                              <button
                                onClick={() => toggleArt(key)}
                                className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/[0.015] transition-colors"
                              >
                                <span className="text-[13px] font-medium text-gray-700 dark:text-gray-300 pr-4 leading-snug">{art.q}</span>
                                <motion.div
                                  animate={{ rotate: openArt === key ? 90 : 0 }}
                                  transition={{ duration: 0.15 }}
                                  className="shrink-0"
                                >
                                  <ChevronRight size={14} className="text-gray-400" />
                                </motion.div>
                              </button>
                              <AnimatePresence initial={false}>
                                {openArt === key && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.18 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="px-5 pb-4 pt-1 text-[12.5px] text-gray-500 dark:text-gray-400 leading-relaxed bg-slate-50/60 dark:bg-white/[0.01]">
                                      {art.a}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── ¿No encontraste tu respuesta? ── */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-2xl p-6 bg-white dark:bg-[#0d1117] flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
          <Mail size={18} className="text-gray-500 dark:text-gray-400" />
        </div>
        <div className="flex-1">
          <p className="text-[13.5px] font-bold text-gray-900 dark:text-gray-100 leading-none mb-1">¿No encontraste tu respuesta?</p>
          <p className="text-[12px] text-gray-400 leading-relaxed">Escríbenos directamente y te respondemos en menos de 24 horas.</p>
        </div>
        <a
          href="mailto:contacto@lucebase.mx"
          className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 text-[13px] font-semibold rounded-xl transition-colors"
        >
          Contactar
          <ArrowRight size={13} />
        </a>
      </div>

    </div>
  );
}

// ─── Resultado de búsqueda individual ────────────────────────────────────────

function SearchResultItem({ result }: { result: { catLabel: string; q: string; a: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-white dark:bg-[#0d1117]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors gap-4"
      >
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">{result.catLabel}</p>
          <p className="text-[13px] font-medium text-gray-800 dark:text-gray-200 leading-snug">{result.q}</p>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.15 }} className="shrink-0 mt-1">
          <ChevronDown size={14} className="text-gray-400" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3.5 pt-1 text-[12.5px] text-gray-500 dark:text-gray-400 leading-relaxed border-t border-gray-100 dark:border-gray-800">
              {result.a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
