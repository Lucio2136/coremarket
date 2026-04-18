import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { Copy, Check, Users, Gift, TrendingUp } from "lucide-react";

interface ReferralModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReferralModal({ open, onOpenChange }: ReferralModalProps) {
  const { profile } = useAuth();
  const [copied, setCopied] = useState(false);

  const code = profile?.referral_code ?? "—";
  const referralLink = `${window.location.origin}/?ref=${code}`;

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Gift size={20} className="text-violet-500" />
            Programa de referidos
          </DialogTitle>
        </DialogHeader>

        {/* Descripción */}
        <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 text-sm text-violet-800 leading-relaxed">
          Invita a tus amigos a Coremarket. Cuando se registren con tu código,
          <span className="font-bold"> ambos reciben $50 MXN</span> de bono directo a su saldo.
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Users size={14} className="text-gray-400" />
              <p className="text-[11px] text-gray-400 uppercase tracking-wide font-semibold">Referidos</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 tabular-nums">
              {profile?.referral_count ?? 0}
            </p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <TrendingUp size={14} className="text-emerald-500" />
              <p className="text-[11px] text-emerald-600 uppercase tracking-wide font-semibold">Ganado</p>
            </div>
            <p className="text-2xl font-bold text-emerald-600 tabular-nums">
              ${(profile?.referral_earnings_mxn ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 0 })}
              <span className="text-sm font-medium ml-1">MXN</span>
            </p>
          </div>
        </div>

        {/* Código */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tu código</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-100 rounded-xl px-4 py-3 font-mono text-xl font-bold text-gray-900 tracking-[0.25em] text-center select-all">
              {code}
            </div>
            <button
              onClick={copyCode}
              className="shrink-0 p-3 bg-gray-900 hover:bg-gray-700 active:bg-gray-800 text-white rounded-xl transition-colors"
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>
        </div>

        {/* Link */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">O comparte el link</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-500 truncate font-mono">
              {referralLink}
            </div>
            <button
              onClick={copyLink}
              className="shrink-0 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Copiar
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
