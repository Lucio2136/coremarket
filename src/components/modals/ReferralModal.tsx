import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Copy, Check, Users, Gift, TrendingUp, X } from "lucide-react";

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

  if (!open) return null;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "flex-end", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={() => onOpenChange(false)}
    >
      <div
        style={{ backgroundColor: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", padding: "24px 20px 32px", boxSizing: "border-box" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Gift size={20} color="#8b5cf6" />
            <span style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>Programa de referidos</span>
          </div>
          <button onClick={() => onOpenChange(false)} style={{ padding: 4, color: "#9ca3af" }}>
            <X size={20} />
          </button>
        </div>

        {/* Descripción */}
        <div style={{ backgroundColor: "#f5f3ff", border: "1px solid #ede9fe", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "#5b21b6", lineHeight: 1.6, marginBottom: 16 }}>
          Invita a tus amigos a Coremarket. Cuando se registren con tu código,{" "}
          <strong>ambos reciben $50 MXN</strong> de bono directo a su saldo.
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div style={{ backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 4 }}>
              <Users size={13} color="#9ca3af" />
              <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Referidos</span>
            </div>
            <p style={{ fontSize: 24, fontWeight: 700, color: "#111827", margin: 0 }}>{profile?.referral_count ?? 0}</p>
          </div>
          <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: 12, textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 4 }}>
              <TrendingUp size={13} color="#10b981" />
              <span style={{ fontSize: 10, color: "#059669", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Ganado</span>
            </div>
            <p style={{ fontSize: 22, fontWeight: 700, color: "#059669", margin: 0 }}>
              ${(profile?.referral_earnings_mxn ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 0 })}
              <span style={{ fontSize: 13, fontWeight: 500, marginLeft: 4 }}>MXN</span>
            </p>
          </div>
        </div>

        {/* Código */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Tu código</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, backgroundColor: "#f3f4f6", borderRadius: 12, padding: "12px 16px", fontFamily: "monospace", fontSize: 20, fontWeight: 700, color: "#111827", letterSpacing: "0.2em", textAlign: "center" }}>
              {code}
            </div>
            <button
              onClick={copyCode}
              style={{ flexShrink: 0, padding: 12, backgroundColor: "#111827", color: "#fff", borderRadius: 12, border: "none", cursor: "pointer" }}
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>
        </div>

        {/* Link */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>O comparte el link</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", fontSize: 11, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }}>
              {referralLink}
            </div>
            <button
              onClick={copyLink}
              style={{ flexShrink: 0, padding: "10px 16px", backgroundColor: "#2563eb", color: "#fff", borderRadius: 12, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}
            >
              Copiar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
