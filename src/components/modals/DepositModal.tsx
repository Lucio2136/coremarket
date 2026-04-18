import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { X, Shield, ChevronRight, Banknote, CreditCard, Building2, MailWarning } from "lucide-react";

interface DepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000];

const PAYMENT_METHODS = [
  { icon: CreditCard, label: "Tarjeta",  sub: "Visa / MC / Amex" },
  { icon: Banknote,   label: "OXXO",     sub: "Pago en efectivo"  },
  { icon: Building2,  label: "SPEI",     sub: "Transferencia"     },
];

export const DepositModal: React.FC<DepositModalProps> = ({ open, onOpenChange }) => {
  const { user } = useAuth();
  const emailVerified = !!user?.email_confirmed_at;
  const [amount, setAmount]   = useState("");
  const [loading, setLoading] = useState(false);
  const numAmount = parseInt(amount) || 0;

  const handleDeposit = async () => {
    if (!user) return;
    if (numAmount < 100) { toast.error("Monto mínimo: $100 MXN"); return; }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const res = await fetch(`${supabaseUrl}/functions/v1/create-conekta-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ amount_mxn: numAmount, origin: window.location.origin }),
      });

      const data = await res.json();
      if (!res.ok || !data?.checkout_url) throw new Error(data?.error ?? "No se pudo iniciar el pago");
      window.location.href = data.checkout_url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al procesar");
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) { onOpenChange(false); setAmount(""); }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          onClick={handleClose}
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full md:max-w-[420px] bg-white dark:bg-gray-900 rounded-t-3xl md:rounded-2xl shadow-2xl overflow-hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            {/* Drag handle (móvil) */}
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Depositar fondos</h2>
                <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">Elige cuánto quieres agregar</p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Contenido scrollable */}
            <div className="overflow-y-auto max-h-[75vh] md:max-h-none">
              <div className="px-5 py-5 flex flex-col gap-5">

                {/* Banner email no verificado */}
                {!emailVerified && (
                  <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl">
                    <MailWarning size={16} className="text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-amber-800 dark:text-amber-300">Verifica tu correo primero</p>
                      <p className="text-[12px] text-amber-700 dark:text-amber-400 mt-0.5 leading-snug">
                        Revisa tu bandeja y haz clic en el enlace de verificación.
                      </p>
                    </div>
                  </div>
                )}

                {/* Montos rápidos */}
                <div className="flex flex-col gap-3">
                  <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Monto</p>

                  <div className="grid grid-cols-5 gap-2">
                    {QUICK_AMOUNTS.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setAmount(String(v))}
                        className={`py-3 rounded-xl text-[13px] font-bold border transition-all active:scale-95 ${
                          numAmount === v
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        }`}
                      >
                        ${v >= 1000 ? `${v / 1000}k` : v}
                      </button>
                    ))}
                  </div>

                  {/* Input manual */}
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-base">$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                      placeholder="Otro monto..."
                      className="w-full pl-9 pr-16 py-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-base font-semibold text-gray-800 dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:outline-none focus:border-blue-400 focus:bg-white dark:focus:bg-gray-750 transition-colors"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-bold text-gray-400">MXN</span>
                  </div>
                  <p className="text-[12px] text-gray-400 dark:text-gray-500 -mt-1">Mínimo $100 · Máximo $50,000 MXN</p>
                </div>

                {/* Métodos de pago */}
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Métodos aceptados</p>
                  <div className="grid grid-cols-3 gap-2">
                    {PAYMENT_METHODS.map(({ icon: Icon, label, sub }) => (
                      <div
                        key={label}
                        className="flex flex-col items-center gap-1.5 px-2 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl"
                      >
                        <div className="w-8 h-8 rounded-lg bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 flex items-center justify-center shadow-sm">
                          <Icon size={14} className="text-gray-500 dark:text-gray-400" />
                        </div>
                        <p className="text-[12px] font-bold text-gray-800 dark:text-gray-200">{label}</p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center leading-tight">{sub}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Botón CTA */}
                <button
                  onClick={handleDeposit}
                  disabled={loading || numAmount < 100 || !emailVerified}
                  className="w-full flex items-center justify-center gap-2 py-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[15px] rounded-2xl transition-colors shadow-sm active:scale-[0.98]"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Redirigiendo...
                    </>
                  ) : (
                    <>
                      {numAmount >= 100
                        ? `Ir a pagar $${numAmount.toLocaleString("es-MX")} MXN`
                        : "Selecciona un monto"}
                      {numAmount >= 100 && <ChevronRight size={17} />}
                    </>
                  )}
                </button>

                <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center flex items-center justify-center gap-1.5 -mt-2 pb-1">
                  <Shield size={11} />
                  Pago procesado de forma segura por Conekta
                </p>

              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
