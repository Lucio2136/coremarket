import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { X, Banknote, Building2, Shield, ChevronRight, AlertCircle } from "lucide-react";

interface WithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000];

export const WithdrawModal: React.FC<WithdrawModalProps> = ({ open, onOpenChange }) => {
  const { balance } = useAuth();
  const [amount, setAmount]         = useState("");
  const [clabe, setClabe]           = useState("");
  const [bankName, setBankName]     = useState("");
  const [holderName, setHolderName] = useState("");
  const [loading, setLoading]       = useState(false);

  const numAmount = parseFloat(amount) || 0;
  const isValid   =
    numAmount >= 50 &&
    numAmount <= balance &&
    clabe.length === 18 &&
    !!bankName.trim() &&
    !!holderName.trim();

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false);
      setAmount(""); setClabe(""); setBankName(""); setHolderName("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount < 50)      { toast.error("El monto mínimo es $50 MXN"); return; }
    if (numAmount > balance) { toast.error("Saldo insuficiente"); return; }
    if (clabe.length !== 18) { toast.error("La CLABE debe tener 18 dígitos"); return; }
    if (!bankName.trim())    { toast.error("Indica el nombre del banco"); return; }
    if (!holderName.trim())  { toast.error("Indica el nombre del titular"); return; }

    setLoading(true);
    try {
      const { error } = await supabase.rpc("request_withdrawal", {
        p_amount:       numAmount,
        p_bank_details: { clabe, bank_name: bankName.trim(), holder_name: holderName.trim() },
      });
      if (error) throw error;
      toast.success(`Solicitud de $${numAmount.toLocaleString("es-MX")} MXN enviada. Se procesará en 1–3 días hábiles.`);
      handleClose();
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message ||
        (err as { error?: string })?.error ||
        "Error al solicitar retiro";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
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
            className="relative w-full md:max-w-[440px] bg-white dark:bg-gray-900 rounded-t-3xl md:rounded-2xl shadow-2xl overflow-hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            {/* Drag handle (móvil) */}
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Retirar fondos</h2>
                <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">Transferencia vía SPEI en 1–3 días</p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Contenido scrollable */}
            <div className="overflow-y-auto max-h-[80vh] md:max-h-none">
              <form onSubmit={handleSubmit} className="px-5 py-5 flex flex-col gap-5">

                {/* Saldo disponible */}
                <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <Banknote size={16} className="text-emerald-600 dark:text-emerald-400" />
                    <span className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-300">Saldo disponible</span>
                  </div>
                  <span className="text-[15px] font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                    ${balance.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN
                  </span>
                </div>

                {/* Monto */}
                <div className="flex flex-col gap-3">
                  <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Monto a retirar</p>

                  <div className="grid grid-cols-5 gap-2">
                    {QUICK_AMOUNTS.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setAmount(String(v))}
                        disabled={v > balance}
                        className={`py-3 rounded-xl text-[13px] font-bold border transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed ${
                          numAmount === v
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        }`}
                      >
                        ${v >= 1000 ? `${v / 1000}k` : v}
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-base">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                      placeholder="0"
                      required
                      className="w-full pl-9 pr-16 py-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-base font-bold text-gray-900 dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:outline-none focus:border-blue-400 focus:bg-white dark:focus:bg-gray-750 transition-colors"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-bold text-gray-400">MXN</span>
                  </div>

                  {numAmount > balance && balance > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50 rounded-xl">
                      <AlertCircle size={13} className="text-rose-500 shrink-0" />
                      <p className="text-[12px] text-rose-600 dark:text-rose-400">El monto supera tu saldo disponible</p>
                    </div>
                  )}
                  <p className="text-[12px] text-gray-400 dark:text-gray-500 -mt-1">Mínimo: $50 MXN</p>
                </div>

                {/* Datos bancarios */}
                <div className="flex flex-col gap-3">
                  <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Building2 size={12} />
                    Datos bancarios (SPEI)
                  </p>

                  {/* CLABE */}
                  <div>
                    <label className="text-[12px] font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">
                      CLABE interbancaria
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={clabe}
                      onChange={(e) => setClabe(e.target.value.replace(/\D/g, "").slice(0, 18))}
                      placeholder="18 dígitos"
                      required
                      maxLength={18}
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3.5 text-gray-900 dark:text-gray-100 font-mono text-[15px] tracking-widest bg-gray-50 dark:bg-gray-800 focus:outline-none focus:border-blue-400 focus:bg-white dark:focus:bg-gray-750 transition-colors placeholder:tracking-normal placeholder:text-gray-300 dark:placeholder:text-gray-600"
                    />
                    <p className={`text-[12px] mt-1 tabular-nums ${clabe.length === 18 ? "text-emerald-500" : "text-gray-400 dark:text-gray-500"}`}>
                      {clabe.length}/18 dígitos {clabe.length === 18 && "✓"}
                    </p>
                  </div>

                  {/* Banco */}
                  <div>
                    <label className="text-[12px] font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">Banco</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="BBVA, Banamex, HSBC..."
                      required
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3.5 text-gray-900 dark:text-gray-100 text-sm bg-gray-50 dark:bg-gray-800 focus:outline-none focus:border-blue-400 focus:bg-white dark:focus:bg-gray-750 transition-colors placeholder:text-gray-300 dark:placeholder:text-gray-600"
                    />
                  </div>

                  {/* Titular */}
                  <div>
                    <label className="text-[12px] font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">Nombre del titular</label>
                    <input
                      type="text"
                      value={holderName}
                      onChange={(e) => setHolderName(e.target.value)}
                      placeholder="Nombre completo"
                      required
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3.5 text-gray-900 dark:text-gray-100 text-sm bg-gray-50 dark:bg-gray-800 focus:outline-none focus:border-blue-400 focus:bg-white dark:focus:bg-gray-750 transition-colors placeholder:text-gray-300 dark:placeholder:text-gray-600"
                    />
                  </div>
                </div>

                {/* Botón */}
                <button
                  type="submit"
                  disabled={loading || !isValid}
                  className="w-full flex items-center justify-center gap-2 py-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[15px] rounded-2xl transition-colors shadow-sm active:scale-[0.98]"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Enviando solicitud...
                    </>
                  ) : (
                    <>
                      {numAmount >= 50
                        ? `Solicitar $${numAmount.toLocaleString("es-MX")} MXN`
                        : "Solicitar retiro"}
                      {isValid && <ChevronRight size={17} />}
                    </>
                  )}
                </button>

                <p className="text-[11px] text-center text-gray-400 dark:text-gray-500 flex items-center justify-center gap-1.5 -mt-2 pb-1">
                  <Shield size={11} />
                  Los retiros se procesan en 1–3 días hábiles
                </p>

              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
