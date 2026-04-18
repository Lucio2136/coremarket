import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, TrendingUp, DollarSign, CheckCircle, HelpCircle, ArrowRight, BarChart2, ShieldCheck, CreditCard } from "lucide-react";

// ─── Pasos ───────────────────────────────────────────────────────────────────

const HOW_STEPS = [
  {
    icon: TrendingUp,
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    num: "01",
    title: "Elige un mercado",
    desc: "Selecciona un evento de política, deportes o entretenimiento. Cada mercado es una pregunta con resultado verificable.",
  },
  {
    icon: DollarSign,
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    num: "02",
    title: "Toma una posición",
    desc: "Compra Sí o No con pesos MXN. El precio refleja la probabilidad del mercado en tiempo real.",
  },
  {
    icon: CheckCircle,
    color: "text-violet-600",
    bg: "bg-violet-50 dark:bg-violet-950/30",
    num: "03",
    title: "Cobra si aciertas",
    desc: "Al resolverse, los ganadores reparten el pozo completo. Cuanto antes entres, mejor precio.",
  },
];

// ─── FAQs por sección ────────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: "general",
    icon: HelpCircle,
    label: "General",
    color: "text-violet-600",
    bg: "bg-violet-50 dark:bg-violet-950/30",
    items: [
      {
        q: "¿Qué es Coremarket?",
        a: "Coremarket es una plataforma de mercados de predicción en español con pesos mexicanos. Apuestas sobre si ocurrirá o no un evento real — política, deportes, entretenimiento — y si aciertas, cobras una parte del pozo total.",
      },
      {
        q: "¿Cómo se determina el precio (50%, 65%...)?",
        a: "El precio lo fija el mercado automáticamente. Cuando más gente compra «Sí», ese precio sube y el de «No» baja. Es la sabiduría colectiva en tiempo real — igual que una bolsa de valores, pero de predicciones. Nadie fija el precio manualmente.",
      },
      {
        q: "¿Es legal apostar en Coremarket?",
        a: "Coremarket opera como plataforma de entretenimiento de predicciones. Los mercados se basan en eventos verificables públicamente. Te recomendamos revisar la regulación de tu estado o región.",
      },
      {
        q: "¿Qué tipos de mercado existen?",
        a: "Hay tres tipos: Binario (Sí o No), Múltiple opción (varios candidatos o resultados posibles) y Scalar (predices un valor numérico dentro de un rango, como el precio de algo o cuántos puntos marcará un jugador).",
      },
    ],
  },
  {
    id: "predicciones",
    icon: BarChart2,
    label: "Predicciones",
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    items: [
      {
        q: "¿Cuál es la apuesta mínima?",
        a: "El monto mínimo por predicción es de $10 MXN. No hay un máximo establecido, pero está limitado a tu saldo disponible.",
      },
      {
        q: "¿Cuál es la ganancia máxima posible?",
        a: "Depende del precio al que entraste. Si compraste Sí a $0.20 (20%) y ganas, recibes ~$5 por cada $1 invertido. Menor probabilidad = mayor pago si aciertas. La fórmula es simple: ganancia = monto ÷ precio_de_entrada.",
      },
      {
        q: "¿Qué pasa si el mercado se cierra sin resolución?",
        a: "Si el evento no puede verificarse con fuentes públicas, el mercado se cancela y recibes tu inversión de vuelta íntegra. Nunca perderás dinero por causas ajenas al resultado.",
      },
      {
        q: "¿Quién resuelve los mercados?",
        a: "El equipo de Coremarket verifica el resultado usando fuentes públicas verificables (noticias, estadísticas oficiales, declaraciones). Una vez confirmado, el sistema acredita los pagos automáticamente a los ganadores.",
      },
      {
        q: "¿Puedo tener posiciones en ambos lados (Sí y No)?",
        a: "Actualmente cada usuario puede tener una posición activa por mercado. Si ya compraste Sí, no puedes comprar No en el mismo mercado.",
      },
    ],
  },
  {
    id: "pagos",
    icon: CreditCard,
    label: "Pagos y saldo",
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    items: [
      {
        q: "¿Cómo deposito dinero?",
        a: "Haz clic en «Depósito» en el header. Ingresa el monto y los datos de tu tarjeta de crédito o débito. Los pagos se procesan de forma segura a través de Stripe. En modo prueba usa: 4242 4242 4242 4242 / 12/28 / 123.",
      },
      {
        q: "¿Cuánto tarda en acreditarse mi depósito?",
        a: "Los depósitos se acreditan de forma instantánea una vez que Stripe confirma el pago (generalmente en segundos).",
      },
      {
        q: "¿Cómo retiro mi saldo?",
        a: "Ve a tu perfil (clic en tu avatar → Retirar) e ingresa el monto y datos bancarios. Los retiros se procesan manualmente en 1–3 días hábiles.",
      },
      {
        q: "¿Hay comisión?",
        a: "Coremarket retiene un 3% del pago bruto como fee de plataforma. El resto se acredita íntegro al ganador. No hay comisiones por depósito ni por retiro.",
      },
      {
        q: "¿Es seguro ingresar mi tarjeta?",
        a: "Sí. Todos los pagos se procesan a través de Stripe, uno de los procesadores de pago más seguros del mundo. Coremarket nunca almacena los datos de tu tarjeta.",
      },
    ],
  },
  {
    id: "seguridad",
    icon: ShieldCheck,
    label: "Seguridad y cuenta",
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    items: [
      {
        q: "¿Cómo protege Coremarket mis datos?",
        a: "Usamos Row Level Security (RLS) de Supabase para que solo tú puedas acceder a tus datos. Las contraseñas se encriptan y los pagos se procesan a través de Stripe sin que almacenemos datos de tarjeta.",
      },
      {
        q: "¿Cómo funciona el programa de referidos?",
        a: "Comparte tu código de referido desde el ícono de regalo en el header. Cuando un amigo se registre con tu código, ambos reciben $50 MXN de bono directo a su saldo.",
      },
      {
        q: "¿Qué pasa si detecto actividad sospechosa en mi cuenta?",
        a: "Contáctanos de inmediato a contacto@coremarket.mx. Bloquearemos tu cuenta preventivamente y revisaremos la actividad. Te recomendamos cambiar tu contraseña desde otro dispositivo.",
      },
    ],
  },
];

// ─── Componente FAQ item ──────────────────────────────────────────────────────

function FAQItem({ q, a, isOpen, onToggle }: { q: string; a: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-gray-100 dark:border-gray-800 last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-start justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-white/[0.015] transition-colors"
      >
        <span className="text-[13.5px] font-medium text-gray-800 dark:text-gray-200 leading-snug">{q}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          className="shrink-0 mt-0.5"
        >
          <ChevronDown size={15} className="text-gray-400" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-4 text-[12.5px] text-gray-500 dark:text-gray-400 leading-relaxed">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function FAQPage() {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const toggle = (key: string) => setOpenKey((prev) => (prev === key ? null : key));

  const visibleSections = activeSection
    ? SECTIONS.filter((s) => s.id === activeSection)
    : SECTIONS;

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-12">

      {/* ── Header ── */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
            <HelpCircle size={13} className="text-amber-500" />
          </div>
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Preguntas frecuentes</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100" style={{ letterSpacing: "-0.025em" }}>
          ¿Cómo funciona Coremarket?
        </h1>
        <p className="text-[13px] text-gray-400">Mercados de predicción en pesos MXN · Todo lo que necesitas saber.</p>
      </div>

      {/* ── Pasos ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {HOW_STEPS.map((step, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.22 }}
            className="flex flex-col gap-3 p-4 rounded-2xl bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-gray-800"
          >
            <div className="flex items-center justify-between">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${step.bg}`}>
                <step.icon size={15} className={step.color} />
              </div>
              <span
                className="text-[22px] font-black text-gray-100 dark:text-gray-800 leading-none select-none"
               
              >
                {step.num}
              </span>
            </div>
            <div>
              <p className="text-[13px] font-bold text-gray-900 dark:text-gray-100 mb-1">{step.title}</p>
              <p className="text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed">{step.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Filtros de sección ── */}
      <div>
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => setActiveSection(null)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold transition-colors ${
              activeSection === null
                ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            Todas
          </button>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(activeSection === s.id ? null : s.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold transition-colors ${
                activeSection === s.id
                  ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              <s.icon size={12} />
              {s.label}
            </button>
          ))}
        </div>

        {/* ── Acordeones por sección ── */}
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {visibleSections.map((section) => (
              <motion.div
                key={section.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden bg-white dark:bg-[#0d1117]"
              >
                {/* Cabecera de sección */}
                <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${section.bg}`}>
                    <section.icon size={13} className={section.color} />
                  </div>
                  <p className="text-[12px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">
                    {section.label}
                  </p>
                  <span className="ml-auto text-[11px] font-medium text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                    {section.items.length}
                  </span>
                </div>

                {/* Items */}
                {section.items.map((item, i) => {
                  const key = `${section.id}-${i}`;
                  return (
                    <FAQItem
                      key={key}
                      q={item.q}
                      a={item.a}
                      isOpen={openKey === key}
                      onToggle={() => toggle(key)}
                    />
                  );
                })}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Ir al centro de ayuda ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0d1117]">
        <div>
          <p className="text-[13.5px] font-bold text-gray-900 dark:text-gray-100 leading-none mb-1">
            ¿Necesitas más ayuda?
          </p>
          <p className="text-[12px] text-gray-400">
            En el Centro de ayuda encontrarás guías detalladas y soporte directo.
          </p>
        </div>
        <Link
          to="/help"
          className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 text-[13px] font-semibold rounded-xl transition-colors whitespace-nowrap"
        >
          Centro de ayuda
          <ArrowRight size={13} />
        </Link>
      </div>

    </div>
  );
}
