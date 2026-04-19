import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, DollarSign, Trophy, ArrowRight, X } from "lucide-react";

const STEPS = [
  {
    icon: TrendingUp,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    title: "Bienvenido a Lucebase",
    body: "El mercado de predicciones en español. Aquí apuestas sobre lo que dirán o harán personajes públicos — y ganas si aciertas.",
    cta: "Siguiente",
  },
  {
    icon: DollarSign,
    color: "text-blue-600",
    bg: "bg-blue-50",
    title: "¿Cómo funciona?",
    body: "Elige un mercado, decide si crees que ocurrirá (Sí) o no (No), y pon tu monto. El precio refleja la probabilidad: 70% significa que el mercado cree que hay 70% de chance.",
    cta: "Siguiente",
  },
  {
    icon: Trophy,
    color: "text-amber-500",
    bg: "bg-amber-50",
    title: "Gana si aciertas",
    body: "Cuando el mercado se resuelve, los ganadores reparten el pozo completo. Deposita desde $10 MXN y empieza a predecir.",
    cta: "Empezar",
  },
];

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
}

export function OnboardingModal({ open, onClose }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const handleCta = () => {
    if (isLast) {
      onClose();
      navigate("/");
    } else {
      setStep((s) => s + 1);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors z-10"
        >
          <X size={15} />
        </button>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 pt-5 pb-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === step
                  ? "w-5 h-1.5 bg-gray-900"
                  : i < step
                  ? "w-1.5 h-1.5 bg-gray-400"
                  : "w-1.5 h-1.5 bg-gray-200"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="px-6 pt-6 pb-7 text-center"
          >
            {/* Icon */}
            <div className={`w-14 h-14 rounded-2xl ${current.bg} flex items-center justify-center mx-auto mb-4`}>
              <current.icon size={26} className={current.color} />
            </div>

            {/* Text */}
            <h2 className="text-[18px] font-bold text-gray-900 mb-2" style={{ letterSpacing: "-0.02em" }}>
              {current.title}
            </h2>
            <p className="text-[13.5px] text-gray-500 leading-relaxed">
              {current.body}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* CTA */}
        <div className="px-6 pb-6">
          <button
            onClick={handleCta}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gray-900 hover:bg-gray-800 active:bg-black text-white text-[14px] font-semibold rounded-xl transition-colors"
          >
            {current.cta}
            {!isLast && <ArrowRight size={15} />}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
