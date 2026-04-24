import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid,
} from "recharts";
import {
  LayoutDashboard, TrendingUp, Users, Plus, LogOut,
  CheckCircle, XCircle, Trash2, RefreshCw, DollarSign,
  Activity, Clock, Flame, AlertTriangle, ArrowUpRight,
  Landmark, FileText, ArrowDownCircle, Building2, User, ShieldCheck,
  ShieldAlert, Zap, Pencil, X, PlusCircle, MinusCircle, ScrollText, Sparkles,
} from "lucide-react";

type Tab = "dashboard" | "markets" | "users" | "create" | "treasury" | "withdrawals" | "auditlog" | "historial" | "borradores";

/** Abreviado solo para ejes de gráficas */
function fmtMXN(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}
/** Exacto con 2 decimales — usar para todos los montos financieros */
function fmtExact(n: number) {
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function initials(name: string) {
  return (name || "?").split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();
}

const SIDEBAR_ITEMS = [
  { key: "dashboard",   icon: LayoutDashboard,  label: "Dashboard"     },
  { key: "markets",     icon: TrendingUp,        label: "Mercados"      },
  { key: "users",       icon: Users,             label: "Usuarios"      },
  { key: "create",      icon: Plus,              label: "Nuevo mercado" },
  { key: "borradores",  icon: Sparkles,          label: "Borradores IA" },
  { key: "treasury",    icon: Landmark,          label: "Tesorería"     },
  { key: "withdrawals", icon: ArrowDownCircle,   label: "Retiros"       },
  { key: "auditlog",    icon: ScrollText,        label: "Audit Log"     },
  { key: "historial",   icon: FileText,          label: "Historial"     },
] as const;

const PAGE_TITLES: Record<Tab, string> = {
  dashboard:   "Dashboard",
  markets:     "Mercados",
  users:       "Usuarios",
  create:      "Nuevo mercado",
  borradores:  "Borradores IA",
  treasury:    "Tesorería",
  withdrawals: "Gestión de Retiros",
  auditlog:    "Audit Log",
  historial:   "Historial de Mercados",
};

// KPI card color themes
const KPI_THEMES = [
  { bg: "#ffffff", border: "#e8ecf0", numColor: "#0f172a", iconBg: "#059669", accentBg: "#ecfdf5", accentColor: "#059669", label: "Pozo total" },
  { bg: "#ffffff", border: "#e8ecf0", numColor: "#0f172a", iconBg: "#2563eb", accentBg: "#eff6ff", accentColor: "#2563eb", label: "Usuarios" },
  { bg: "#ffffff", border: "#e8ecf0", numColor: "#0f172a", iconBg: "#0369a1", accentBg: "#f0f9ff", accentColor: "#0369a1", label: "Mercados" },
  { bg: "#ffffff", border: "#e8ecf0", numColor: "#0f172a", iconBg: "#d97706", accentBg: "#fffbeb", accentColor: "#d97706", label: "Predicciones" },
  { bg: "#ffffff", border: "#e8ecf0", numColor: "#0f172a", iconBg: "#7c3aed", accentBg: "#fdf4ff", accentColor: "#7c3aed", label: "Retiros" },
];

const CHART_COLORS = ["#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#dbeafe", "#eff6ff", "#f8fafc"];

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#1e293b", border: "none",
      borderRadius: 8, padding: "8px 14px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.18)", fontSize: 12,
    }}>
      <p style={{ color: "#94a3b8", marginBottom: 2, margin: "0 0 3px" }}>{payload[0]?.payload?.name}</p>
      <p className="admin-num" style={{ color: "#fff", fontWeight: 600, margin: 0 }}>${payload[0]?.value?.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN</p>
    </div>
  );
}

export default function AdminPage() {
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab]                   = useState<Tab>("dashboard");
  const [markets, setMarkets]             = useState<any[]>([]);
  const [users, setUsers]                 = useState<any[]>([]);
  const [bets, setBets]                   = useState<any[]>([]);
  const [financials, setFinancials]       = useState<any>(null);
  const [dailyVolume, setDailyVolume]     = useState<any[]>([]);
  const [categoryStats, setCategoryStats] = useState<any[]>([]);
  const [withdrawals, setWithdrawals]     = useState<any[]>([]);
  const [loadingData, setLoadingData]     = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [userSearch, setUserSearch]       = useState("");
  const [isFrozen, setIsFrozen]           = useState(false);
  const [freezeLoading, setFreezeLoading] = useState(false);
  const [lastBetByUser, setLastBetByUser] = useState<Record<string, string>>({});
  const [panicConfirm, setPanicConfirm]   = useState(false);
  const [auditResult, setAuditResult]     = useState<any>(null);
  const [auditLog, setAuditLog]           = useState<any[]>([]);
  const [auditLoading, setAuditLoading]   = useState(false);
  const [generatingMarkets, setGeneratingMarkets] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);

  // Historial
  const [histFilter, setHistFilter] = useState<"all" | "open" | "closed" | "resolved">("all");
  const [histSearch, setHistSearch] = useState("");
  const [histSort,   setHistSort]   = useState<"pool" | "bettors" | "date">("date");

  // Editar mercado
  const [editingMarketId, setEditingMarketId] = useState<string | null>(null);
  const [editMarketForm, setEditMarketForm]   = useState({
    title: "", closes_at: "", yes_odds: 2.0, no_odds: 2.0, yes_percent: 50,
  });

  // Ajuste de balance
  const [adjustingUserId, setAdjustingUserId] = useState<string | null>(null);
  const [adjustForm, setAdjustForm]           = useState({ amount: "", reason: "" });

  const [newMarket, setNewMarket] = useState({
    title: "", subject_name: "", category: "Política",
    market_type: "binary" as "binary" | "multiple" | "scalar",
    yes_odds: 2.0, no_odds: 2.0, yes_percent: 50, no_percent: 50,
    closes_at: "", is_trending: false,
    scalar_min: 0, scalar_max: 100, scalar_unit: "",
    subject_photo_url: "",
    description: "", rules: "",
  });
  // Resolución scalar: market_id → valor numérico ingresado
  const [scalarResultInput, setScalarResultInput] = useState<Record<string, string>>({});

  // ── Wikipedia helpers ─────────────────────────────────────────────────────
  const fetchWikiPhoto = async (name: string): Promise<string | null> => {
    const slug = encodeURIComponent(name.trim().replace(/ /g, "_"));
    const tryLang = async (lang: "es" | "en") => {
      try {
        const res = await fetch(
          `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${slug}`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (!res.ok) return null;
        const data = await res.json();
        // Prefer full-resolution original; fall back to thumbnail upscaled to 800px
        if (data?.originalimage?.source) return data.originalimage.source as string;
        if (data?.thumbnail?.source) {
          // Wikipedia thumbnail URLs support size substitution (e.g. 220px → 800px)
          return (data.thumbnail.source as string).replace(/\/\d+px-/, "/800px-");
        }
        return null;
      } catch { return null; }
    };
    return (await tryLang("es")) ?? (await tryLang("en"));
  };

  // Wikipedia auto-fetch
  const [wikiLoading, setWikiLoading] = useState(false);
  const [wikiSource, setWikiSource]   = useState<"es" | "en" | null>(null);
  const wikiTimer     = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const optionTimers  = React.useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const fetchOptionPhoto = (index: number, label: string) => {
    if (optionTimers.current[index]) clearTimeout(optionTimers.current[index]);
    if (!label.trim() || label.trim().length < 3) return;
    optionTimers.current[index] = setTimeout(async () => {
      setMultipleOptions((prev) => prev.map((o, i) => i === index ? { ...o, loading: true } : o));
      const url = await fetchWikiPhoto(label);
      setMultipleOptions((prev) => prev.map((o, i) =>
        i === index
          ? { ...o, loading: false, photo_url: o.photo_url.trim() ? o.photo_url : (url ?? "") }
          : o
      ));
    }, 600);
  };

  // Dispara búsqueda 600ms después de que el admin deje de escribir el nombre del sujeto
  React.useEffect(() => {
    const name = newMarket.subject_name.trim();
    if (!name || name.length < 3) { setWikiSource(null); return; }

    if (wikiTimer.current) clearTimeout(wikiTimer.current);
    wikiTimer.current = setTimeout(async () => {
      setWikiLoading(true);
      setWikiSource(null);
      const url = await fetchWikiPhoto(name);
      // Siempre actualizar: el nombre cambió, la foto debe cambiar también
      setNewMarket((prev) => ({ ...prev, subject_photo_url: url ?? "" }));
      if (url) setWikiSource("es");
      setWikiLoading(false);
    }, 600);

    return () => { if (wikiTimer.current) clearTimeout(wikiTimer.current); };
  }, [newMarket.subject_name]);
  const [multipleOptions, setMultipleOptions] = useState<
    { label: string; photo_url: string; loading: boolean }[]
  >([
    { label: "", photo_url: "", loading: false },
    { label: "", photo_url: "", loading: false },
    { label: "", photo_url: "", loading: false },
  ]);
  // Para resolver mercados de opción múltiple: market_id → option_id seleccionado
  const [resolveOptionId, setResolveOptionId] = useState<Record<string, string>>({});
  const [marketOptionsMap, setMarketOptionsMap] = useState<Record<string, any[]>>({});

  const totalPool     = markets.reduce((a, m) => a + (m.total_pool || 0), 0);
  const activeMarkets = markets.filter((m) => m.status === "open").length;
  const totalBets     = bets.length;
  const totalUsers    = users.length;

  // ── Monitor de Riesgo ─────────────────────────────────────────────────────
  // Liquidez del banco = Total depósitos − saldos de usuarios
  const sumUserBalances = users.reduce((s, u) => s + (u.balance_mxn || 0), 0);
  const bankLiquidity   = Math.max((financials?.total_deposits || 0) - sumUserBalances, 1);

  function marketLiability(m: any): number {
    const yesPool = (m.total_pool || 0) * ((m.yes_percent || 50) / 100);
    const noPool  = (m.total_pool || 0) * ((100 - (m.yes_percent || 50)) / 100);
    return Math.max(yesPool * (m.yes_odds || 2), noPool * (m.no_odds || 2));
  }
  function isHighRisk(m: any): boolean {
    return marketLiability(m) > bankLiquidity * 0.5;
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/"); return; }
    if (profile === null) return; // profile aún cargando
    if (!profile?.is_admin) { navigate("/"); return; }
    fetchAll();
  }, [user, authLoading, profile]);

  const fetchAll = useCallback(async () => {
    setLoadingData(true);
    const [mRes, uRes, bRes, finRes, volRes, wRes, aRes, sRes, lbRes] = await Promise.all([
      supabase.from("markets").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("bets").select("*, profiles(username), markets(title, category)").order("created_at", { ascending: false }).limit(50),
      supabase.from("admin_financial_stats").select("*").single(),
      supabase.from("transactions").select("created_at, amount").eq("type", "bet")
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from("withdrawals").select("*, profiles(username, balance_mxn)").order("created_at", { ascending: false }),
      supabase.from("audit_log").select("*").order("run_at", { ascending: false }).limit(100),
      supabase.from("system_settings").select("is_frozen").single(),
      supabase.from("bets").select("user_id, created_at").order("created_at", { ascending: false }).limit(500),
    ]);
    const fetchedMarkets = mRes.data || [];
    setMarkets(fetchedMarkets);

    // Intentar enriquecer perfiles con email via RPC (requiere que la función exista en Supabase)
    const profiles = uRes.data || [];
    const { data: withEmail } = await supabase.rpc("get_users_with_email");
    if (withEmail) {
      const emailMap: Record<string, string> = {};
      (withEmail as any[]).forEach((r) => { if (r.id && r.email) emailMap[r.id] = r.email; });
      setUsers(profiles.map((p: any) => ({ ...p, email: emailMap[p.id] ?? null })));
    } else {
      setUsers(profiles);
    }

    setBets(bRes.data || []);
    setFinancials(finRes.data || null);
    setWithdrawals(wRes.data || []);
    setAuditLog(aRes.data || []);
    setIsFrozen(sRes.data?.is_frozen ?? false);

    // Cargar opciones de mercados de tipo 'multiple'
    const multipleIds = fetchedMarkets
      .filter((m: any) => m.market_type === "multiple")
      .map((m: any) => m.id);
    if (multipleIds.length > 0) {
      const { data: optsData } = await supabase
        .from("market_options")
        .select("*")
        .in("market_id", multipleIds)
        .order("sort_order", { ascending: true });
      if (optsData) {
        const map: Record<string, any[]> = {};
        optsData.forEach((opt: any) => {
          if (!map[opt.market_id]) map[opt.market_id] = [];
          map[opt.market_id].push(opt);
        });
        setMarketOptionsMap(map);
      }
    }

    // Última apuesta por usuario (para badge Dormido)
    const lbMap: Record<string, string> = {};
    (lbRes.data || []).forEach((b: any) => {
      if (!lbMap[b.user_id]) lbMap[b.user_id] = b.created_at;
    });
    setLastBetByUser(lbMap);

    // Volumen diario — agrupa por día
    if (volRes.data) {
      const grouped: Record<string, number> = {};
      volRes.data.forEach((t: any) => {
        const day = t.created_at.slice(0, 10);
        grouped[day] = (grouped[day] || 0) + Math.abs(t.amount);
      });
      setDailyVolume(
        Object.entries(grouped)
          .map(([date, volume]) => ({
            date: new Date(date).toLocaleDateString("es-MX", { day: "numeric", month: "short" }),
            volume,
          }))
          .sort((a, b) => a.date.localeCompare(b.date))
      );
    }

    // Estadísticas por categoría (de las últimas 50 apuestas + mercados)
    const catMap: Record<string, { volume: number; fee: number; count: number }> = {};
    (bRes.data || []).forEach((b: any) => {
      const cat = b.markets?.category || "Sin categoría";
      if (!catMap[cat]) catMap[cat] = { volume: 0, fee: 0, count: 0 };
      catMap[cat].volume += b.amount || 0;
      catMap[cat].fee    += b.fee_amount || 0;
      catMap[cat].count  += 1;
    });
    setCategoryStats(
      Object.entries(catMap)
        .map(([category, s]) => ({ category, ...s }))
        .sort((a, b) => b.volume - a.volume)
    );

    setLoadingData(false);
  }, []);

  const runAudit = async () => {
    setAuditLoading(true);
    try {
      const { data, error } = await supabase.rpc("run_financial_audit");
      if (error) throw error;
      setAuditResult(data);
      // Refresca el histórico
      const { data: logData } = await supabase
        .from("audit_log")
        .select("*")
        .order("run_at", { ascending: false })
        .limit(20);
      setAuditLog(logData || []);
      if (data.is_balanced) {
        toast.success("Auditoría completada — sistema cuadrado");
      } else {
        toast.error(`Auditoría: GAP detectado de $${Math.abs(data.gap).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN`);
      }
    } catch (err: any) {
      toast.error(err.message || "Error al ejecutar auditoría");
    } finally {
      setAuditLoading(false);
    }
  };

  const resolveMarket = async (marketId: string, side: "yes" | "no" | null, optionId?: string) => {
    const label = optionId
      ? (marketOptionsMap[marketId]?.find((o) => o.id === optionId)?.label ?? "opción seleccionada")
      : (side === "yes" ? "SÍ" : "NO");
    if (!confirm(`¿Resolver con "${label}" como ganador?`)) return;

    setActionLoading(marketId + (side ?? optionId ?? ""));
    try {
      const params: Record<string, unknown> = { p_market_id: marketId };
      if (optionId) params.p_winning_option_id = optionId;
      else          params.p_winning_side      = side;

      const { error } = await supabase.rpc("resolve_market", params);
      if (error) throw error;
      toast.success("Mercado resuelto — ganadores pagados");
      fetchAll();

      // Notificar ganadores en segundo plano (no bloquear si falla)
      supabase.functions
        .invoke("notify-winners", { body: { market_id: marketId } })
        .then(({ error: nErr }) => {
          if (nErr) console.warn("[notify-winners] Error al notificar:", nErr.message);
        });
    } catch (err: any) { toast.error(err.message); }
    finally { setActionLoading(null); }
  };

  const resolveScalarMarket = async (marketId: string) => {
    const raw = scalarResultInput[marketId];
    const value = parseFloat(raw);
    if (isNaN(value)) { toast.error("Ingresa un valor numérico válido"); return; }
    if (!confirm(`¿Resolver mercado scalar con resultado: ${value}?`)) return;
    setActionLoading(marketId + "scalar");
    try {
      const { error } = await supabase.rpc("resolve_scalar_market", { p_market_id: marketId, p_result: value });
      if (error) throw error;
      toast.success("Mercado scalar resuelto — ganadores pagados");
      fetchAll();
    } catch (err: any) { toast.error(err.message); }
    finally { setActionLoading(null); }
  };

  const publishDraft = async (marketId: string) => {
    setActionLoading(marketId + "publish");
    try {
      const { error } = await supabase.from("markets").update({ status: "open" }).eq("id", marketId);
      if (error) throw error;
      toast.success("Mercado publicado — ya es visible al público");
      fetchAll();
    } catch (err: any) { toast.error(err.message); }
    finally { setActionLoading(null); }
  };

  const loadDraft = async (m: any) => {
    const existingPhoto = (m.subject_photo_url ?? "").trim();
    setNewMarket({
      title:             m.title             ?? "",
      subject_name:      m.subject_name      ?? "",
      category:          m.category          ?? "Política",
      market_type:       m.market_type       ?? "binary",
      yes_odds:          m.yes_odds          ?? 2.0,
      no_odds:           m.no_odds           ?? 2.0,
      yes_percent:       m.yes_percent       ?? 50,
      no_percent:        100 - (m.yes_percent ?? 50),
      closes_at:         m.closes_at         ? m.closes_at.slice(0, 16) : "",
      is_trending:       m.is_trending       ?? false,
      scalar_min:        m.scalar_min        ?? 0,
      scalar_max:        m.scalar_max        ?? 100,
      scalar_unit:       m.scalar_unit       ?? "",
      subject_photo_url: existingPhoto,
      description:       m.description       ?? "",
      rules:             m.rules             ?? "",
    });
    setEditingDraftId(m.id);
    setTab("create");
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Si el borrador no tiene foto, buscarla en Wikipedia de inmediato
    if (!existingPhoto && m.subject_name?.trim()) {
      setWikiLoading(true);
      const url = await fetchWikiPhoto(m.subject_name.trim());
      if (url) {
        setNewMarket((prev) => ({ ...prev, subject_photo_url: prev.subject_photo_url.trim() ? prev.subject_photo_url : url }));
        setWikiSource("es");
      }
      setWikiLoading(false);
    }
  };

  const deleteDraft = async (marketId: string) => {
    if (!confirm("¿Eliminar este borrador?")) return;
    setActionLoading(marketId + "del");
    try {
      const { error } = await supabase.from("markets").delete().eq("id", marketId);
      if (error) throw error;
      toast.success("Borrador eliminado");
      fetchAll();
    } catch (err: any) { toast.error(err.message); }
    finally { setActionLoading(null); }
  };

  const generateWithAI = async () => {
    setGeneratingMarkets(true);
    try {
      const daysFromNow = (d: number) => {
        const dt = new Date();
        dt.setDate(dt.getDate() + d);
        return dt.toISOString();
      };

      const TEMPLATES: Omit<any, "status" | "total_pool" | "bettor_count" | "market_type">[] = [
        // ── Música / Entretenimiento ──────────────────────────────────────────
        { title: "¿Peso Pluma lanzará un álbum completo antes de diciembre 2026?", subject_name: "Peso Pluma", category: "Entretenimiento", yes_percent: 72, no_percent: 28, yes_odds: 1.4, no_odds: 3.2, closes_at: daysFromNow(150), description: "Hassan viene on fire pero su ritmo de lanzamientos es impredecible" },
        { title: "¿Nodal y Ángela Aguilar anunciarán su primer embarazo en 2026?", subject_name: "Nodal", category: "Famosos", yes_percent: 44, no_percent: 56, yes_odds: 2.1, no_odds: 1.8, closes_at: daysFromNow(180), description: "Los Pepe Aguilar Jr. están recién casados, el morbo está al 100" },
        { title: "¿Cazzu sacará canción dedicada a Nodal antes de agosto 2026?", subject_name: "Cazzu", category: "Entretenimiento", yes_percent: 38, no_percent: 62, yes_odds: 2.5, no_odds: 1.6, closes_at: daysFromNow(120), description: "La Nena Trampa tiene todo el derecho y el material emocional" },
        { title: "¿Peso Pluma colaborará con Bad Bunny en 2026?", subject_name: "Peso Pluma", category: "Entretenimiento", yes_percent: 55, no_percent: 45, yes_odds: 1.8, no_odds: 2.1, closes_at: daysFromNow(210), description: "Dos reyes del género, la collab más pedida del año" },
        { title: "¿Natanael Cano aparecerá en el Coachella 2027?", subject_name: "Natanael Cano", category: "Entretenimiento", yes_percent: 30, no_percent: 70, yes_odds: 3.1, no_odds: 1.4, closes_at: daysFromNow(160), description: "El corrido tumbado conquistó EU, ¿llegará al escenario más importante?" },
        { title: "¿Junior H lanzará colaboración con artista pop en 2026?", subject_name: "Junior H", category: "Entretenimiento", yes_percent: 48, no_percent: 52, yes_odds: 2.0, no_odds: 1.9, closes_at: daysFromNow(140), description: "El corrido sad busca nuevos públicos" },
        { title: "¿Ángela Aguilar ganará un Grammy Latino antes de 2027?", subject_name: "Ángela Aguilar", category: "Entretenimiento", yes_percent: 41, no_percent: 59, yes_odds: 2.3, no_odds: 1.7, closes_at: daysFromNow(200), description: "Tiene el apellido, el talento y la polémica a su favor" },
        { title: "¿Nodal lanzará un disco de ranchera puro antes de fin de año?", subject_name: "Nodal", category: "Entretenimiento", yes_percent: 33, no_percent: 67, yes_odds: 2.8, no_odds: 1.5, closes_at: daysFromNow(180), description: "Dicen que quiere regresar a sus raíces después del drama" },
        { title: "¿Peso Pluma superará 100M de oyentes en Spotify en 2026?", subject_name: "Peso Pluma", category: "Entretenimiento", yes_percent: 58, no_percent: 42, yes_odds: 1.7, no_odds: 2.2, closes_at: daysFromNow(240), description: "Ya está en los 80M, la trayectoria apunta hacia arriba" },
        { title: "¿Fuerza Regida hará una gira conjunta con Peso Pluma en 2026?", subject_name: "Fuerza Regida", category: "Entretenimiento", yes_percent: 62, no_percent: 38, yes_odds: 1.6, no_odds: 2.5, closes_at: daysFromNow(150), description: "La combinación más poderosa del corrido tumbado" },

        // ── Influencers ───────────────────────────────────────────────────────
        { title: "¿Domelipa llegará a 90M seguidores en TikTok antes de octubre 2026?", subject_name: "Domelipa", category: "Famosos", yes_percent: 65, no_percent: 35, yes_odds: 1.5, no_odds: 2.7, closes_at: daysFromNow(170), description: "La reina del TikTok mexicano no para de crecer" },
        { title: "¿Wendy Guevara saldrá en una telenovela de Televisa en 2026?", subject_name: "Wendy Guevara", category: "Famosos", yes_percent: 52, no_percent: 48, yes_odds: 1.9, no_odds: 2.0, closes_at: daysFromNow(200), description: "El trampolín de LCDLF la catapultó, Televisa siempre va por el rating" },
        { title: "¿Lizbeth Rodríguez se reconciliará con algún ex en 2026?", subject_name: "Lizbeth Rodríguez", category: "Famosos", yes_percent: 28, no_percent: 72, yes_odds: 3.3, no_odds: 1.4, closes_at: daysFromNow(120), description: "La reina del drama romántico en redes" },
        { title: "¿Gomita protagonizará una polémica viral antes de julio 2026?", subject_name: "Gomita", category: "Famosos", yes_percent: 78, no_percent: 22, yes_odds: 1.3, no_odds: 4.0, closes_at: daysFromNow(90), description: "Gomita y la polémica son inseparables, la historia lo confirma" },
        { title: "¿Kunno llegará al millón de suscriptores en YouTube en 2026?", subject_name: "Kunno", category: "Famosos", yes_percent: 45, no_percent: 55, yes_odds: 2.1, no_odds: 1.8, closes_at: daysFromNow(150), description: "El rey del cringe mexicano busca consolidarse fuera de TikTok" },
        { title: "¿Kimberly La Más Preciosa tendrá su propia serie en 2026?", subject_name: "Kimberly La Más Preciosa", category: "Famosos", yes_percent: 35, no_percent: 65, yes_odds: 2.7, no_odds: 1.5, closes_at: daysFromNow(180), description: "El fenómeno de Vecinos que conquistó internet" },
        { title: "¿Yeri Mua lanzará línea de maquillaje propia antes de diciembre 2026?", subject_name: "Yeri Mua", category: "Famosos", yes_percent: 60, no_percent: 40, yes_odds: 1.6, no_odds: 2.4, closes_at: daysFromNow(200), description: "Ya tiene el público fiel y la influencia de belleza" },
        { title: "¿Luisito Comunica superará 50M suscriptores en YouTube en 2026?", subject_name: "Luisito Comunica", category: "Famosos", yes_percent: 55, no_percent: 45, yes_odds: 1.8, no_odds: 2.1, closes_at: daysFromNow(220), description: "El youtuber mexicano más grande sigue creciendo" },

        // ── Política ──────────────────────────────────────────────────────────
        { title: "¿Claudia Sheinbaum terminará su primer año con más del 60% de aprobación?", subject_name: "Claudia Sheinbaum", category: "Política", yes_percent: 58, no_percent: 42, yes_odds: 1.7, no_odds: 2.2, closes_at: daysFromNow(100), description: "La primera presidenta de México enfrenta su primera crisis" },
        { title: "¿México declarará emergencia económica en 2026 por aranceles de Trump?", subject_name: "México", category: "Política", yes_percent: 32, no_percent: 68, yes_odds: 2.9, no_odds: 1.5, closes_at: daysFromNow(150), description: "La guerra comercial entre EU y México tiene a todos nerviosos" },
        { title: "¿Morena ganará más del 50% de las gubernaturas en elecciones de 2026?", subject_name: "Morena", category: "Política", yes_percent: 66, no_percent: 34, yes_odds: 1.5, no_odds: 2.7, closes_at: daysFromNow(200), description: "El partido guinda sigue dominando el mapa electoral" },
        { title: "¿Xóchitl Gálvez lanzará candidatura en 2027?", subject_name: "Xóchitl Gálvez", category: "Política", yes_percent: 42, no_percent: 58, yes_odds: 2.2, no_odds: 1.7, closes_at: daysFromNow(180), description: "La senadora no se rinde fácilmente" },
        { title: "¿AMLO hará declaración política controversial desde Palenque antes de julio 2026?", subject_name: "AMLO", category: "Política", yes_percent: 85, no_percent: 15, yes_odds: 1.2, no_odds: 5.5, closes_at: daysFromNow(80), description: "El exPresidente en modo blogger chiapaneco siempre tiene algo que decir" },
        { title: "¿México y EU firmarán nuevo acuerdo comercial antes de 2027?", subject_name: "México", category: "Política", yes_percent: 40, no_percent: 60, yes_odds: 2.4, no_odds: 1.7, closes_at: daysFromNow(250), description: "El T-MEC bajo presión, ¿habrá renegociación?" },

        // ── Deportes ──────────────────────────────────────────────────────────
        { title: "¿Canelo Álvarez peleará en México antes de diciembre 2026?", subject_name: "Canelo Álvarez", category: "Deportes", yes_percent: 48, no_percent: 52, yes_odds: 2.0, no_odds: 1.9, closes_at: daysFromNow(200), description: "El Rey siempre pelea en EU, ¿regalará una pelea a su tierra?" },
        { title: "¿Canelo Álvarez ganará su próxima pelea por KO?", subject_name: "Canelo Álvarez", category: "Deportes", yes_percent: 55, no_percent: 45, yes_odds: 1.8, no_odds: 2.1, closes_at: daysFromNow(120), description: "El Canelo busca recuperar su imagen dominante" },
        { title: "¿Chivas llegará a la final del Clausura 2026?", subject_name: "Chivas", category: "Deportes", yes_percent: 38, no_percent: 62, yes_odds: 2.5, no_odds: 1.6, closes_at: daysFromNow(60), description: "El Rebaño Sagrado siempre promete y raramente cumple" },
        { title: "¿Club América ganará el Apertura 2026?", subject_name: "Club América", category: "Deportes", yes_percent: 45, no_percent: 55, yes_odds: 2.1, no_odds: 1.8, closes_at: daysFromNow(160), description: "Las Águilas buscan otro bicampeonato" },
        { title: "¿La Selección Mexicana clasificará al Mundial 2026 en primer lugar de CONCACAF?", subject_name: "Selección Mexicana", category: "Deportes", yes_percent: 42, no_percent: 58, yes_odds: 2.3, no_odds: 1.7, closes_at: daysFromNow(120), description: "El Tri en casa, con presión histórica por ser sede del Mundial" },
        { title: "¿México llegará a cuartos de final en el Mundial 2026?", subject_name: "Selección Mexicana", category: "Deportes", yes_percent: 35, no_percent: 65, yes_odds: 2.7, no_odds: 1.5, closes_at: daysFromNow(180), description: "El quinto partido maldito, ¿se rompe la maldición en casa?" },
        { title: "¿Hirving Lozano se retirará de la Selección antes del Mundial 2026?", subject_name: "Hirving Lozano", category: "Deportes", yes_percent: 22, no_percent: 78, yes_odds: 4.1, no_odds: 1.3, closes_at: daysFromNow(100), description: "El Chucky sigue siendo clave para el Tri a pesar de las lesiones" },
        { title: "¿Tigres o Rayados ganará el clásico regio en el siguiente torneo?", subject_name: "Tigres UANL", category: "Deportes", yes_percent: 50, no_percent: 50, yes_odds: 1.9, no_odds: 1.9, closes_at: daysFromNow(80), description: "El duelo más intenso del norte de México" },
        { title: "¿Guillermo Ochoa seguirá siendo titular en el Mundial 2026?", subject_name: "Guillermo Ochoa", category: "Deportes", yes_percent: 60, no_percent: 40, yes_odds: 1.6, no_odds: 2.4, closes_at: daysFromNow(150), description: "El Memo es eterno, pero hay competencia real ahora" },

        // ── Economía ──────────────────────────────────────────────────────────
        { title: "¿El dólar superará $22 pesos MXN antes de septiembre 2026?", subject_name: "Dólar / Peso MXN", category: "Economía", yes_percent: 45, no_percent: 55, yes_odds: 2.1, no_odds: 1.8, closes_at: daysFromNow(150), description: "Los aranceles de Trump presionan al peso mexicano" },
        { title: "¿La inflación en México bajará del 4% antes de diciembre 2026?", subject_name: "Banxico", category: "Economía", yes_percent: 38, no_percent: 62, yes_odds: 2.5, no_odds: 1.6, closes_at: daysFromNow(200), description: "Banxico sigue con política restrictiva para controlar precios" },
        { title: "¿Pemex anunciará un nuevo descubrimiento de petróleo significativo en 2026?", subject_name: "Pemex", category: "Economía", yes_percent: 30, no_percent: 70, yes_odds: 3.1, no_odds: 1.4, closes_at: daysFromNow(180), description: "La empresa más endeudada del mundo necesita buenas noticias" },
        { title: "¿México recibirá más de $50B USD en nearshoring en 2026?", subject_name: "México", category: "Economía", yes_percent: 55, no_percent: 45, yes_odds: 1.8, no_odds: 2.0, closes_at: daysFromNow(240), description: "La reconfiguración de cadenas de suministro favorece a México" },
        { title: "¿El salario mínimo en México subirá más del 10% en 2027?", subject_name: "STPS México", category: "Economía", yes_percent: 62, no_percent: 38, yes_odds: 1.6, no_odds: 2.5, closes_at: daysFromNow(200), description: "El gobierno ha subido el salario mínimo varios años consecutivos" },
        { title: "¿Bajarán las tasas de interés de Banxico a menos del 8% antes de 2027?", subject_name: "Banxico", category: "Economía", yes_percent: 48, no_percent: 52, yes_odds: 2.0, no_odds: 1.9, closes_at: daysFromNow(250), description: "La inflación controlada abre la puerta a recortes" },
        { title: "¿El peso mexicano se fortalecerá a menos de $18 por dólar en 2026?", subject_name: "Dólar / Peso MXN", category: "Economía", yes_percent: 20, no_percent: 80, yes_odds: 4.5, no_odds: 1.3, closes_at: daysFromNow(200), description: "El peso viene perdiendo terreno, revertirlo sería histórico" },

        // ── Más morbo / Entretenimiento ───────────────────────────────────────
        { title: "¿Karol G visitará México en gira antes de diciembre 2026?", subject_name: "Karol G", category: "Entretenimiento", yes_percent: 70, no_percent: 30, yes_odds: 1.4, no_odds: 3.1, closes_at: daysFromNow(200), description: "La Bichota ama México y México la ama a ella" },
        { title: "¿Bad Bunny lanzará nuevo álbum en 2026?", subject_name: "Bad Bunny", category: "Entretenimiento", yes_percent: 60, no_percent: 40, yes_odds: 1.6, no_odds: 2.4, closes_at: daysFromNow(180), description: "El conejo malo tiene ritmo de un álbum por año" },
        { title: "¿Grupo Firme se separará en 2026?", subject_name: "Grupo Firme", category: "Entretenimiento", yes_percent: 15, no_percent: 85, yes_odds: 6.0, no_odds: 1.2, closes_at: daysFromNow(180), description: "Hay rumores de tensiones internas en el grupo de Eduin Caz" },
        { title: "¿Eduin Caz de Grupo Firme protagonizará una polémica viral en 2026?", subject_name: "Eduin Caz", category: "Famosos", yes_percent: 75, no_percent: 25, yes_odds: 1.3, no_odds: 3.7, closes_at: daysFromNow(120), description: "Eduin y la polémica van de la mano desde siempre" },
        { title: "¿Shakira lanzará colaboración con artista mexicano en 2026?", subject_name: "Shakira", category: "Entretenimiento", yes_percent: 50, no_percent: 50, yes_odds: 1.9, no_odds: 1.9, closes_at: daysFromNow(160), description: "La colombiana ha explorado el regional mexicano con éxito" },
        { title: "¿Christian Nodal lanzará canción que haga referencia indirecta a Cazzu?", subject_name: "Nodal", category: "Famosos", yes_percent: 40, no_percent: 60, yes_odds: 2.4, no_odds: 1.6, closes_at: daysFromNow(90), description: "Los artistas siempre tienen algo que decir sobre sus ex" },
        { title: "¿Peso Pluma ganará el Grammy Latino al Álbum del Año en 2026?", subject_name: "Peso Pluma", category: "Entretenimiento", yes_percent: 35, no_percent: 65, yes_odds: 2.7, no_odds: 1.5, closes_at: daysFromNow(200), description: "El corrido tumbado busca el reconocimiento máximo de la industria" },
        { title: "¿Teletubbies mexicanos (Dulce, Kimberly, Wendy, Paola) harán reality show en 2026?", subject_name: "Las Perdidas", category: "Famosos", yes_percent: 45, no_percent: 55, yes_odds: 2.1, no_odds: 1.8, closes_at: daysFromNow(150), description: "El grupo más viral de México podría conquistar la televisión" },
        { title: "¿La youtuber mexicana Yuya regresará activamente a YouTube en 2026?", subject_name: "Yuya", category: "Famosos", yes_percent: 30, no_percent: 70, yes_odds: 3.1, no_odds: 1.4, closes_at: daysFromNow(150), description: "La pionera del YouTube en español lleva tiempo alejada" },
        { title: "¿Belinda lanzará nuevo sencillo antes de agosto 2026?", subject_name: "Belinda", category: "Entretenimiento", yes_percent: 65, no_percent: 35, yes_odds: 1.5, no_odds: 2.7, closes_at: daysFromNow(110), description: "La princesa del pop mexicano siempre vuelve" },
        { title: "¿Televisa lanzará un reality show de corridos tumbados en 2026?", subject_name: "Televisa", category: "Entretenimiento", yes_percent: 38, no_percent: 62, yes_odds: 2.5, no_odds: 1.6, closes_at: daysFromNow(160), description: "Televisa siempre sigue las tendencias, aunque tarde" },
        { title: "¿El Escorpión Dorado hará entrevista viral con político mexicano en 2026?", subject_name: "El Escorpión Dorado", category: "Famosos", yes_percent: 80, no_percent: 20, yes_odds: 1.3, no_odds: 4.5, closes_at: daysFromNow(100), description: "Escorpión siempre consigue lo imposible con su estilo único" },
        { title: "¿Peso Pluma será nombrado embajador del turismo mexicano en 2026?", subject_name: "Peso Pluma", category: "Política", yes_percent: 22, no_percent: 78, yes_odds: 4.2, no_odds: 1.3, closes_at: daysFromNow(200), description: "El gobierno siempre busca íconos populares para promover México" },
        { title: "¿Habrá escándalo de corrupción de alto nivel en México antes de octubre 2026?", subject_name: "México", category: "Política", yes_percent: 82, no_percent: 18, yes_odds: 1.2, no_odds: 5.0, closes_at: daysFromNow(160), description: "La historia de México habla por sí sola" },
        { title: "¿El Inter Miami de Messi visitará México para partido en 2026?", subject_name: "Lionel Messi", category: "Deportes", yes_percent: 55, no_percent: 45, yes_odds: 1.8, no_odds: 2.1, closes_at: daysFromNow(180), description: "Messi en México sería el evento del año" },
        { title: "¿Checo Pérez regresará a la Fórmula 1 con algún equipo en 2027?", subject_name: "Checo Pérez", category: "Deportes", yes_percent: 40, no_percent: 60, yes_odds: 2.4, no_odds: 1.7, closes_at: daysFromNow(240), description: "El tapatío busca la manera de volver al paddock" },
        { title: "¿El GP de México 2026 venderá más entradas que el de 2025?", subject_name: "GP México", category: "Deportes", yes_percent: 68, no_percent: 32, yes_odds: 1.5, no_odds: 3.0, closes_at: daysFromNow(200), description: "El Gran Premio de México siempre rompe récords de asistencia" },
      ];

      // Mezcla aleatoria y toma 10
      const shuffled = [...TEMPLATES].sort(() => Math.random() - 0.5).slice(0, 10);

      const CAT_MAP: Record<string, string> = { Famosos: "Entretenimiento", Economía: "Finanzas" };
      const toInsert = shuffled.map(({ no_percent: _np, ...t }) => ({
        ...t,
        category: CAT_MAP[t.category] ?? t.category,
        market_type: "binary",
        total_pool: 0,
        bettor_count: 0,
        status: "draft",
        is_trending: false,
      }));

      const { data, error } = await supabase.from("markets").insert(toInsert).select("id");
      if (error) throw error;

      toast.success(`10 borradores listos para revisar — ¡elige los mejores!`);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Error al generar mercados");
    } finally {
      setGeneratingMarkets(false);
    }
  };

  const deleteMarket = async (marketId: string) => {
    if (!confirm("¿Eliminar este mercado? No se puede deshacer.")) return;
    setActionLoading(marketId + "delete");
    await supabase.from("bets").delete().eq("market_id", marketId);
    await supabase.from("markets").delete().eq("id", marketId);
    toast.success("Mercado eliminado");
    fetchAll();
    setActionLoading(null);
  };

  const createMarket = async () => {
    if (!newMarket.title || !newMarket.subject_name || !newMarket.closes_at) {
      toast.error("Completa todos los campos obligatorios");
      return;
    }
    if (newMarket.market_type === "multiple") {
      const validOptions = multipleOptions.filter((o) => o.label.trim().length > 0);
      if (validOptions.length < 2) {
        toast.error("Agrega al menos 2 opciones para el mercado múltiple");
        return;
      }
    }
    if (newMarket.market_type === "scalar") {
      if (newMarket.scalar_min >= newMarket.scalar_max) {
        toast.error("El valor mínimo debe ser menor al máximo");
        return;
      }
      if (!newMarket.scalar_unit.trim()) {
        toast.error("Ingresa la unidad del valor scalar (ej. %, MXN, seguidores)");
        return;
      }
    }
    setActionLoading("create");
    try {
      const { no_percent: _nc, scalar_min, scalar_max, scalar_unit, subject_photo_url, ...baseMarketData } = newMarket;
      const scalarFields = newMarket.market_type === "scalar"
        ? { scalar_min, scalar_max, scalar_unit: scalar_unit.trim() }
        : {};
      const photoField = subject_photo_url.trim() ? { subject_photo_url: subject_photo_url.trim() } : {};
      const marketPayload = { ...baseMarketData, ...scalarFields, ...photoField, status: "open" };

      let marketRow: { id: string } | null = null;
      if (editingDraftId) {
        // Actualizar el borrador existente en lugar de crear uno nuevo
        const { data, error } = await supabase.from("markets")
          .update(marketPayload)
          .eq("id", editingDraftId)
          .select("id").single();
        if (error) throw error;
        marketRow = data;
      } else {
        const { data, error } = await supabase.from("markets").insert({
          ...marketPayload, total_pool: 0, bettor_count: 0,
        }).select("id").single();
        if (error) throw error;
        marketRow = data;
      }
      if (error) throw error;

      // Si es mercado múltiple, insertar las opciones
      if (newMarket.market_type === "multiple" && marketRow?.id) {
        const validOptions = multipleOptions.filter((o) => o.label.trim().length > 0);
        const nOptions     = validOptions.length;
        const initPercent  = Math.round(100 / nOptions * 10) / 10;
        const initOdds     = parseFloat(nOptions.toFixed(2));

        const rows = validOptions.map((opt, i) => ({
          market_id:  marketRow.id,
          label:      opt.label.trim(),
          photo_url:  opt.photo_url.trim() || null,
          pool:       0,
          percent:    initPercent,
          odds:       initOdds,
          sort_order: i,
        }));
        const { error: optErr } = await supabase.from("market_options").insert(rows);
        if (optErr) {
          // Rollback: eliminar el mercado recién creado para no dejar huérfanos
          await supabase.from("markets").delete().eq("id", marketRow.id);
          throw new Error(`Error al guardar opciones: ${optErr.message}`);
        }
      }

      toast.success(editingDraftId ? "¡Borrador publicado!" : "¡Mercado creado!");
      setEditingDraftId(null);
      setNewMarket({ title: "", subject_name: "", category: "Política",
        market_type: "binary",
        yes_odds: 2.0, no_odds: 2.0, yes_percent: 50, no_percent: 50,
        closes_at: "", is_trending: false,
        scalar_min: 0, scalar_max: 100, scalar_unit: "",
        subject_photo_url: "", description: "", rules: "" });
      setMultipleOptions([
        { label: "", photo_url: "", loading: false },
        { label: "", photo_url: "", loading: false },
        { label: "", photo_url: "", loading: false },
      ]);
      fetchAll();
      setTab("markets");
    } catch (err: any) { toast.error(err.message); }
    finally { setActionLoading(null); }
  };

  const updateMarket = async (marketId: string) => {
    if (!editMarketForm.title.trim() || !editMarketForm.closes_at) {
      toast.error("Título y fecha de cierre son obligatorios");
      return;
    }
    setActionLoading(marketId + "edit");
    try {
      const { error } = await supabase.from("markets").update({
        title:       editMarketForm.title.trim(),
        closes_at:   editMarketForm.closes_at,
        yes_odds:    editMarketForm.yes_odds,
        no_odds:     editMarketForm.no_odds,
        yes_percent: editMarketForm.yes_percent,
      }).eq("id", marketId);
      if (error) throw error;
      toast.success("Mercado actualizado");
      setEditingMarketId(null);
      fetchAll();
    } catch (err: any) { toast.error(err.message); }
    finally { setActionLoading(null); }
  };

  const adjustBalance = async (userId: string, username: string) => {
    const amount = parseFloat(adjustForm.amount);
    if (isNaN(amount) || amount === 0) { toast.error("Ingresa un monto válido (positivo o negativo)"); return; }
    if (!adjustForm.reason.trim())      { toast.error("El motivo es obligatorio");                       return; }
    setActionLoading(userId + "adjust");
    try {
      const targetUser   = users.find((u) => u.id === userId);
      const currentBal   = targetUser?.balance_mxn ?? 0;
      const newBalance   = Math.max(0, currentBal + amount);
      const { error: upErr } = await supabase
        .from("profiles")
        .update({ balance_mxn: newBalance })
        .eq("id", userId);
      if (upErr) throw upErr;
      await supabase.from("transactions").insert({
        user_id:     userId,
        type:        "adjustment",
        amount:      Math.abs(amount),
        description: `Ajuste manual (${amount > 0 ? "crédito" : "débito"}): ${adjustForm.reason.trim()}`,
      });
      toast.success(`Balance de ${username} ${amount > 0 ? "acreditado" : "debitado"} en $${Math.abs(amount).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN`);
      setAdjustingUserId(null);
      setAdjustForm({ amount: "", reason: "" });
      fetchAll();
    } catch (err: any) { toast.error(err.message); }
    finally { setActionLoading(null); }
  };

  const approveWithdrawal = async (id: string, amount: number, username: string) => {
    if (!confirm(`¿Confirmar que el pago de $${amount.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN a ${username} fue enviado?`)) return;
    setActionLoading(id + "approve");
    try {
      const { error } = await supabase.rpc("approve_withdrawal", { p_withdrawal_id: id });
      if (error) throw error;
      toast.success(`Retiro de ${username} marcado como pagado`);
      fetchAll();
    } catch (err: any) { toast.error(err.message); }
    finally { setActionLoading(null); }
  };

  const rejectWithdrawal = async (id: string, amount: number, username: string) => {
    if (!confirm(`¿Rechazar el retiro de $${amount.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN de ${username}? El saldo será devuelto automáticamente.`)) return;
    setActionLoading(id + "reject");
    try {
      const { error } = await supabase.rpc("reject_withdrawal", { p_withdrawal_id: id });
      if (error) throw error;
      toast.success(`Retiro rechazado — $${amount.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN devueltos a ${username}`);
      fetchAll();
    } catch (err: any) { toast.error(err.message); }
    finally { setActionLoading(null); }
  };

  const handleSignOut = async () => { await signOut(); navigate("/"); };

  const toggleFreeze = async () => {
    if (!panicConfirm) {
      // Primera confirmación: mostrar estado de alerta
      setPanicConfirm(true);
      return;
    }
    // Segunda confirmación: ejecutar
    setPanicConfirm(false);
    setFreezeLoading(true);
    try {
      const { error } = await supabase.rpc("set_system_freeze", {
        p_frozen: !isFrozen,
        p_admin_email: user?.email ?? "admin",
      });
      if (error) throw error;
      setIsFrozen(!isFrozen);
      toast[!isFrozen ? "warning" : "success"](
        !isFrozen
          ? "SISTEMA CONGELADO — Todas las operaciones suspendidas"
          : "Sistema reactivado — Operaciones restauradas"
      );
    } catch (err: any) {
      toast.error(err.message || "Error al cambiar estado del sistema");
    } finally {
      setFreezeLoading(false);
    }
  };

  const generatePDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF();
    const now = new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });

    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Lucebase — Reporte de Tesorería", 14, 18);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Generado: ${now}`, 196, 18, { align: "right" });

    // KPIs summary
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Resumen Financiero", 14, 40);

    const kpis = [
      ["Total Depósitos",      `$${(financials?.total_deposits || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`],
      ["Volumen Apostado",     `$${(financials?.total_bets_volume || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`],
      ["Total Pagado (wins)",  `$${(financials?.total_wins_paid || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`],
      ["Net Profit (House)",   `$${(financials?.net_profit || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`],
      ["Fee Realizado (3%)",   `$${(financials?.house_fee_realized || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`],
      ["Liability (riesgo)",   `$${(financials?.liability || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`],
    ];

    autoTable(doc, {
      startY: 44,
      head: [["Métrica", "Valor"]],
      body: kpis,
      headStyles: { fillColor: [37, 99, 235], fontSize: 9, fontStyle: "bold" },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
      margin: { left: 14, right: 14 },
      tableWidth: 90,
    });

    // Por categoría
    const afterKpis = (doc as any).lastAutoTable.finalY + 12;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Volumen por Categoría (últimas 50 apuestas)", 14, afterKpis);

    autoTable(doc, {
      startY: afterKpis + 4,
      head: [["Categoría", "# Predicciones", "Volumen MXN", "Fee Generado MXN"]],
      body: categoryStats.map((c) => [
        c.category,
        c.count,
        `$${c.volume.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `$${c.fee.toFixed(2)}`,
      ]),
      headStyles: { fillColor: [37, 99, 235], fontSize: 9, fontStyle: "bold" },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 1: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });

    // Mercados activos con liability
    const afterCat = (doc as any).lastAutoTable.finalY + 12;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Mercados Abiertos — Exposición del Banco", 14, afterCat);

    const openMarkets = markets.filter((m) => m.status === "open").slice(0, 20);
    autoTable(doc, {
      startY: afterCat + 4,
      head: [["Mercado", "Categoría", "Pool MXN", "Participantes", "SÍ %"]],
      body: openMarkets.map((m) => [
        m.title.slice(0, 50),
        m.category,
        `$${(m.total_pool || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        m.bettor_count || 0,
        `${m.yes_percent || 50}%`,
      ]),
      headStyles: { fillColor: [37, 99, 235], fontSize: 9, fontStyle: "bold" },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 2: { halign: "right" }, 3: { halign: "center" }, 4: { halign: "center" } },
      margin: { left: 14, right: 14 },
    });

    // Retiros de usuarios
    const afterMarkets = (doc as any).lastAutoTable.finalY + 12;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Retiros de Usuarios", 14, afterMarkets);

    const wdSummary: [string, string][] = [
      ["Total retirado (aprobado)", `$${totalWithdrawn.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN`],
      ["Monto pendiente de retiro", `$${withdrawals.filter((w) => w.status === "pending").reduce((s: number, w: any) => s + (w.amount || 0), 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN`],
      ["Solicitudes pendientes",    String(pendingWdCount)],
    ];
    autoTable(doc, {
      startY: afterMarkets + 4,
      head: [["Métrica", "Valor"]],
      body: wdSummary,
      headStyles: { fillColor: [124, 58, 237], fontSize: 9, fontStyle: "bold" },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
      margin: { left: 14, right: 14 },
      tableWidth: 90,
    });

    if (withdrawals.length > 0) {
      const afterWdSummary = (doc as any).lastAutoTable.finalY + 8;
      autoTable(doc, {
        startY: afterWdSummary,
        head: [["Usuario", "Monto MXN", "Estado", "Banco", "Fecha"]],
        body: withdrawals.slice(0, 30).map((w: any) => {
          const details = w.bank_details || {};
          const estado  = w.status === "approved" ? "Pagado" : w.status === "rejected" ? "Rechazado" : "Pendiente";
          return [
            w.profiles?.username || "—",
            `$${(w.amount || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
            estado,
            `${details.bank_name || "—"} ****${(details.clabe || "").slice(-4)}`,
            new Date(w.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }),
          ];
        }),
        headStyles: { fillColor: [124, 58, 237], fontSize: 9, fontStyle: "bold" },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 1: { halign: "right" }, 2: { halign: "center" }, 4: { halign: "right" } },
        margin: { left: 14, right: 14 },
      });
    }

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Lucebase Admin · Página ${i}/${pageCount}`, 105, 290, { align: "center" });
    }

    doc.save(`lucebase-tesoreria-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF generado correctamente");
  };

  if (authLoading) return (
    <div style={{ minHeight: "100vh", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#94a3b8", fontSize: 13 }}>
        <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />
        Verificando acceso...
      </div>
    </div>
  );

  if (!profile?.is_admin) return null;

  const chartData = markets
    .filter((m) => m.total_pool > 0)
    .sort((a, b) => b.total_pool - a.total_pool)
    .slice(0, 8)
    .map((m) => ({ name: m.subject_name.split(" ")[0], pool: m.total_pool }));

  const dateStr = new Date().toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });

  const totalWithdrawn  = withdrawals.filter((w) => w.status === "approved").reduce((s: number, w: any) => s + (w.amount || 0), 0);
  const pendingWdCount  = withdrawals.filter((w) => w.status === "pending").length;

  const kpiData = [
    { label: "Pozo total",      value: fmtExact(totalPool) + " MXN", sub: `${markets.length} mercados`,                   icon: DollarSign      },
    { label: "Usuarios",         value: String(totalUsers),            sub: "registrados",                                icon: Users           },
    { label: "Mercados activos", value: String(activeMarkets),         sub: `${markets.length - activeMarkets} cerrados`, icon: Activity        },
    { label: "Predicciones",     value: String(totalBets),             sub: "últimas 50",                                 icon: TrendingUp      },
    { label: "Retiros pagados",  value: fmtExact(totalWithdrawn) + " MXN", sub: `${pendingWdCount} pendiente${pendingWdCount !== 1 ? "s" : ""}`, icon: ArrowDownCircle },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f0f4f8", fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ══ Sidebar ══ */}
      <aside style={{
        width: 232, flexShrink: 0, position: "fixed", height: "100%",
        background: "#ffffff",
        borderRight: "1px solid #e8ecf0",
        display: "flex", flexDirection: "column", zIndex: 20,
        boxShadow: "2px 0 12px rgba(0,0,0,0.04)",
      }}>
        {/* Logo */}
        <div style={{ padding: "22px 20px 18px", borderBottom: "1px solid #f0f4f8" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34,
              background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
              borderRadius: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 10px rgba(37,99,235,0.35)",
            }}>
              <span style={{ color: "#fff", fontSize: 14, fontWeight: 900, letterSpacing: "-0.03em" }}>L</span>
            </div>
            <div>
              <p style={{ color: "#0f172a", fontSize: 15, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, margin: 0 }}>Lucebase</p>
              <p style={{ color: "#94a3b8", fontSize: 10, letterSpacing: "0.12em", fontWeight: 600, textTransform: "uppercase", marginTop: 3, margin: "3px 0 0" }}>Admin Panel</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
          {SIDEBAR_ITEMS.map(({ key, icon: Icon, label }) => {
            const active = tab === key;
            const badge = key === "withdrawals" && pendingWdCount > 0 ? pendingWdCount : null;
            return (
              <button
                key={key}
                onClick={() => setTab(key as Tab)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 12px", borderRadius: 9, border: "none", cursor: "pointer",
                  background: active ? "#2563eb" : "transparent",
                  color: active ? "#ffffff" : "#64748b",
                  fontSize: 13, fontWeight: active ? 600 : 500,
                  textAlign: "left", width: "100%", transition: "all 0.15s",
                  boxShadow: active ? "0 4px 12px rgba(37,99,235,0.25)" : "none",
                }}
                onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = "#f5f8ff"; (e.currentTarget as HTMLButtonElement).style.color = "#2563eb"; } }}
                onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#64748b"; } }}
              >
                <Icon size={15} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{label}</span>
                {badge !== null && (
                  <span style={{
                    fontSize: 10, fontWeight: 800, minWidth: 18, height: 18,
                    background: active ? "rgba(255,255,255,0.25)" : "#ef4444",
                    color: "#fff", borderRadius: 9,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0 5px",
                  }}>{badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: "12px 10px", borderTop: "1px solid #f0f4f8" }}>
          <div style={{ padding: "6px 12px 10px", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg, #2563eb, #7c3aed)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 800, color: "#fff",
            }}>
              {initials(profile?.username || user.email?.split("@")[0] || "A")}
            </div>
            <p style={{ fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0, flex: 1 }}>
              {user.email}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 12px", borderRadius: 9, border: "1px solid #fee2e2", cursor: "pointer",
              background: "#fff5f5", color: "#ef4444",
              fontSize: 12, fontWeight: 600, width: "100%", transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fee2e2"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fff5f5"; }}
          >
            <LogOut size={14} /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ══ Main ══ */}
      <main style={{ marginLeft: 232, flex: 1, minHeight: "100vh" }}>

        {/* Top bar */}
        <div style={{
          position: "sticky", top: 0, zIndex: 10,
          background: isFrozen ? "#fff1f2" : "#ffffff",
          borderBottom: `1px solid ${isFrozen ? "#fca5a5" : "#e8ecf0"}`,
          padding: "0 28px", height: 60,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          transition: "background 0.3s, border-color 0.3s",
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 16, fontWeight: 700, color: isFrozen ? "#be123c" : "#0f172a", margin: 0, lineHeight: 1, letterSpacing: "-0.02em" }}>
                {PAGE_TITLES[tab]}
              </h1>
              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 3, margin: "3px 0 0", textTransform: "capitalize" }}>
                {dateStr}
              </p>
            </div>
            {isFrozen && (
              <div style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "#fee2e2", border: "1.5px solid #fca5a5",
                borderRadius: 20, padding: "3px 10px",
                fontSize: 11, fontWeight: 800, color: "#be123c",
                animation: "pulse 1.5s infinite",
              }}>
                <ShieldAlert size={12} />
                SISTEMA CONGELADO
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Botón de Pánico */}
            {panicConfirm ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#be123c" }}>
                  ¿Confirmar?
                </span>
                <button
                  onClick={toggleFreeze}
                  disabled={freezeLoading}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "6px 14px", borderRadius: 7,
                    background: isFrozen ? "#059669" : "#dc2626",
                    color: "#fff", border: "none",
                    fontSize: 11, fontWeight: 800, cursor: "pointer",
                  }}
                >
                  <Zap size={11} />
                  {isFrozen ? "SÍ, REACTIVAR" : "SÍ, CONGELAR"}
                </button>
                <button
                  onClick={() => setPanicConfirm(false)}
                  style={{
                    padding: "6px 10px", borderRadius: 7,
                    background: "#f1f5f9", color: "#64748b",
                    border: "1px solid #e8ecf0", fontSize: 11, cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={toggleFreeze}
                disabled={freezeLoading}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 14px", borderRadius: 7,
                  background: isFrozen ? "#dcfce7" : "#fff1f2",
                  color: isFrozen ? "#15803d" : "#be123c",
                  border: `1.5px solid ${isFrozen ? "#86efac" : "#fca5a5"}`,
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <ShieldAlert size={13} />
                {isFrozen ? "Reactivar sistema" : "Botón de Pánico"}
              </button>
            )}

            <button
              onClick={fetchAll}
              disabled={loadingData}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 12px", borderRadius: 7,
                border: "1px solid #e8ecf0", background: "#fff",
                fontSize: 12, color: "#64748b", cursor: "pointer",
              }}
            >
              <RefreshCw size={12} style={{ animation: loadingData ? "spin 1s linear infinite" : "none" }} />
              Actualizar
            </button>
          </div>
        </div>

        <div style={{ padding: 28 }}>

          {/* ══ DASHBOARD ══ */}
          {tab === "dashboard" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* KPIs */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
                {kpiData.map(({ label, value, sub, icon: Icon }, i) => {
                  const theme = KPI_THEMES[i];
                  return (
                    <div key={label} style={{
                      background: theme.bg,
                      borderRadius: 14, border: `1px solid ${theme.border}`,
                      padding: "20px 20px 16px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                      transition: "box-shadow 0.2s, transform 0.2s",
                    }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 20px rgba(0,0,0,0.09)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>
                            {label}
                          </p>
                        </div>
                        <div style={{
                          width: 38, height: 38, borderRadius: 10,
                          background: theme.accentBg,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0,
                        }}>
                          <Icon size={17} color={theme.iconBg} />
                        </div>
                      </div>
                      <p className="admin-num" style={{ fontSize: 22, fontWeight: 600, color: theme.numColor, lineHeight: 1, margin: 0 }}>
                        {value}
                      </p>
                      <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 6, margin: "6px 0 0" }}>
                        {sub}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Chart + top users */}
              <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 16 }}>

                {/* Bar chart */}
                <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8ecf0", padding: "22px 22px 14px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                  <div style={{ marginBottom: 18 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>Pozo por mercado</h3>
                    <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 3, margin: "3px 0 0" }}>Top 8 por volumen · MXN</p>
                  </div>
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={chartData} barSize={24} barCategoryGap="28%">
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtMXN(v)} width={48} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f8fafc", radius: 4 }} />
                        <Bar dataKey="pool" radius={[5, 5, 0, 0]}>
                          {chartData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i] ?? "#bfdbfe"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#cbd5e1", fontSize: 13 }}>
                      Sin datos todavía
                    </div>
                  )}
                </div>

                {/* Top usuarios */}
                <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8ecf0", padding: 22, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>Top usuarios</h3>
                    <span style={{ fontSize: 10, color: "#64748b", background: "#f0f4f8", padding: "3px 10px", borderRadius: 20, fontWeight: 600 }}>
                      por saldo
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {users
                      .sort((a, b) => (b.balance_mxn || 0) - (a.balance_mxn || 0))
                      .slice(0, 6)
                      .map((u, i) => {
                        const medals = ["🥇", "🥈", "🥉"];
                        return (
                          <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 8, background: i === 0 ? "#fffbeb" : "transparent" }}>
                            <span style={{ fontSize: 14, width: 20, textAlign: "center" }}>{medals[i] ?? ""}</span>
                            <div style={{
                              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                              background: i === 0 ? "#fbbf24" : "#e8ecf0",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 10, fontWeight: 700,
                              color: i === 0 ? "#78350f" : "#475569",
                            }}>
                              {initials(u.username || "")}
                            </div>
                            <p style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
                              {u.username || "—"}
                            </p>
                            <p className="admin-num" style={{ fontSize: 12, fontWeight: 600, color: "#059669", margin: 0 }}>
                              ${(u.balance_mxn || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* Últimas predicciones */}
              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8ecf0", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                <div style={{ padding: "16px 22px", borderBottom: "1px solid #f0f4f8", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff" }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>Últimas predicciones</h3>
                  <span style={{ fontSize: 11, color: "#64748b", background: "#f0f4f8", padding: "3px 10px", borderRadius: 20, fontWeight: 600 }}>{bets.length} registros</span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e8ecf0" }}>
                        {[
                          { label: "Usuario", align: "left" },
                          { label: "Mercado", align: "left" },
                          { label: "Lado", align: "center" },
                          { label: "Monto", align: "right" },
                          { label: "Pago pot.", align: "right" },
                          { label: "Estado", align: "center" },
                        ].map(({ label, align }) => (
                          <th key={label} style={{ padding: "11px 18px", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: align as any }}>
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bets.slice(0, 12).map((bet) => (
                        <tr key={bet.id} style={{ borderBottom: "1px solid #f8fafc" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#f8fafc"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                        >
                          <td style={{ padding: "11px 16px", fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                            {bet.profiles?.username || "—"}
                          </td>
                          <td style={{ padding: "11px 16px", fontSize: 12, color: "#64748b", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {bet.markets?.title || "—"}
                          </td>
                          <td style={{ padding: "11px 16px", textAlign: "center" }}>
                            <span style={{
                              display: "inline-block", padding: "3px 10px", borderRadius: 5,
                              fontSize: 11, fontWeight: 800,
                              background: bet.side === "yes" ? "#dcfce7" : "#ffe4e6",
                              color: bet.side === "yes" ? "#15803d" : "#be123c",
                            }}>
                              {bet.side === "yes" ? "SÍ" : "NO"}
                            </span>
                          </td>
                          <td style={{ padding: "11px 16px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
                            ${(bet.amount || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: "11px 16px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#d97706", fontVariantNumeric: "tabular-nums" }}>
                            ${(bet.potential_payout || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: "11px 16px", textAlign: "center" }}>
                            <span style={{
                              display: "inline-block", padding: "3px 10px", borderRadius: 5,
                              fontSize: 11, fontWeight: 600,
                              background: bet.status === "won" ? "#dcfce7" : bet.status === "lost" ? "#ffe4e6" : "#f1f5f9",
                              color: bet.status === "won" ? "#15803d" : bet.status === "lost" ? "#be123c" : "#475569",
                            }}>
                              {bet.status === "won" ? "Ganó" : bet.status === "lost" ? "Perdió" : "Pendiente"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ MERCADOS ══ */}
          {tab === "markets" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {loadingData && (
                <div style={{ textAlign: "center", padding: "64px 0", color: "#94a3b8", fontSize: 13 }}>
                  Cargando mercados...
                </div>
              )}
              {!loadingData && markets.length === 0 && (
                <div style={{ textAlign: "center", padding: "64px 0", color: "#cbd5e1", fontSize: 13 }}>
                  Sin mercados todavía.
                </div>
              )}
              {markets.map((market) => {
                const isOpen = market.status === "open";
                return (
                  <div key={market.id} style={{
                    background: "#fff", borderRadius: 14,
                    border: "1px solid #e8ecf0", padding: "18px 22px",
                    borderLeft: `4px solid ${isOpen ? "#22c55e" : "#94a3b8"}`,
                    boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
                    transition: "box-shadow 0.2s",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: "#0f172a", flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontSize: 11, fontWeight: 700,
                      }}>
                        {initials(market.subject_name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                              {market.is_trending && <Flame size={12} color="#f59e0b" />}
                              <h3 style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", margin: 0, lineHeight: 1.3 }}>
                                {market.title}
                              </h3>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#94a3b8" }}>
                              <span style={{ background: "#f1f5f9", padding: "1px 6px", borderRadius: 4, color: "#475569", fontWeight: 500 }}>{market.category}</span>
                              <span>·</span>
                              <span>{market.subject_name}</span>
                              <span>·</span>
                              <Clock size={10} />
                              <span>{new Date(market.closes_at).toLocaleDateString("es-MX")}</span>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                            {isOpen && isHighRisk(market) && (
                              <span style={{
                                fontSize: 10, padding: "4px 10px", borderRadius: 20,
                                fontWeight: 800,
                                background: "#fee2e2", color: "#be123c",
                                border: "1.5px solid #fca5a5",
                                display: "flex", alignItems: "center", gap: 4,
                              }}>
                                <ShieldAlert size={10} />
                                Alto Riesgo
                              </span>
                            )}
                            <span style={{
                              fontSize: 10, padding: "4px 10px", borderRadius: 20,
                              fontWeight: 700,
                              background: isOpen ? "#dcfce7" : "#f1f5f9",
                              color: isOpen ? "#15803d" : "#64748b",
                            }}>
                              {isOpen ? "● Activo" : `Cerrado · ${market.result?.toUpperCase() ?? ""}`}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 11, marginBottom: 10 }}>
                          <span style={{ fontWeight: 800, color: "#0f172a", fontSize: 13 }}>{fmtExact(market.total_pool || 0)}</span>
                          <span style={{ color: "#94a3b8" }}>{market.bettor_count || 0} participantes</span>
                          {market.market_type !== "scalar" && <>
                            <span style={{ background: "#dcfce7", color: "#15803d", fontWeight: 700, padding: "2px 8px", borderRadius: 4, fontSize: 11 }}>SÍ {market.yes_percent || 50}%</span>
                            <span style={{ background: "#ffe4e6", color: "#be123c", fontWeight: 700, padding: "2px 8px", borderRadius: 4, fontSize: 11 }}>NO {100 - (market.yes_percent || 50)}%</span>
                            <span style={{ color: "#94a3b8" }}>{market.yes_odds}x / {market.no_odds}x</span>
                          </>}
                          {market.market_type === "scalar" && (
                            <span style={{ background: "#eff6ff", color: "#2563eb", fontWeight: 700, padding: "2px 8px", borderRadius: 4, fontSize: 11 }}>
                              📊 {market.scalar_min} – {market.scalar_max} {market.scalar_unit}
                            </span>
                          )}
                          {isOpen && market.market_type !== "scalar" && (
                            <span style={{
                              color: isHighRisk(market) ? "#be123c" : "#64748b",
                              fontWeight: isHighRisk(market) ? 700 : 400,
                            }}>
                              Liability: {fmtExact(marketLiability(market))}
                            </span>
                          )}
                        </div>

                        {market.market_type !== "scalar" && (
                          <div style={{ display: "flex", height: 5, borderRadius: 4, overflow: "hidden", marginBottom: 12, background: "#f1f5f9" }}>
                            <div style={{ background: "#22c55e", width: `${market.yes_percent || 50}%`, transition: "width 0.3s" }} />
                            <div style={{ background: "#f43f5e", width: `${100 - (market.yes_percent || 50)}%`, transition: "width 0.3s" }} />
                          </div>
                        )}

                        {isOpen ? (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {market.market_type === "scalar" ? (
                              /* ── Resolver scalar ── */
                              <>
                                <input
                                  type="number"
                                  placeholder={`Resultado (${market.scalar_min ?? 0} – ${market.scalar_max ?? 100} ${market.scalar_unit ?? ""})`}
                                  value={scalarResultInput[market.id] ?? ""}
                                  onChange={(e) => setScalarResultInput({ ...scalarResultInput, [market.id]: e.target.value })}
                                  style={{
                                    border: "1.5px solid #cbd5e1", borderRadius: 7,
                                    padding: "6px 10px", fontSize: 11, color: "#0f172a",
                                    background: "#f8fafc", fontFamily: "inherit", width: 180, outline: "none",
                                  }}
                                />
                                <button
                                  onClick={() => resolveScalarMarket(market.id)}
                                  disabled={!!actionLoading || !scalarResultInput[market.id]}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 5,
                                    padding: "6px 12px", borderRadius: 7, cursor: "pointer",
                                    background: "#eff6ff", color: "#1d4ed8",
                                    border: "1.5px solid #93c5fd", fontSize: 11, fontWeight: 700,
                                    opacity: (actionLoading || !scalarResultInput[market.id]) ? 0.4 : 1,
                                  }}
                                >
                                  <CheckCircle size={11} />
                                  {actionLoading === market.id + "scalar" ? "Procesando..." : "Resolver"}
                                </button>
                              </>
                            ) : market.market_type === "multiple" ? (
                              /* ── Resolver múltiple opción ── */
                              <>
                                <select
                                  value={resolveOptionId[market.id] ?? ""}
                                  onChange={(e) => setResolveOptionId({ ...resolveOptionId, [market.id]: e.target.value })}
                                  style={{
                                    border: "1.5px solid #cbd5e1", borderRadius: 7,
                                    padding: "6px 10px", fontSize: 11, color: "#0f172a",
                                    background: "#f8fafc", cursor: "pointer", fontFamily: "inherit",
                                  }}
                                >
                                  <option value="">Selecciona ganador...</option>
                                  {(marketOptionsMap[market.id] ?? []).map((opt: any) => (
                                    <option key={opt.id} value={opt.id}>{opt.label} ({opt.percent.toFixed(0)}%)</option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => {
                                    const optId = resolveOptionId[market.id];
                                    if (optId) resolveMarket(market.id, null, optId);
                                    else toast.error("Selecciona la opción ganadora");
                                  }}
                                  disabled={!!actionLoading || !resolveOptionId[market.id]}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 5,
                                    padding: "6px 12px", borderRadius: 7, cursor: "pointer",
                                    background: "#eff6ff", color: "#1d4ed8",
                                    border: "1.5px solid #93c5fd", fontSize: 11, fontWeight: 700,
                                    opacity: (actionLoading || !resolveOptionId[market.id]) ? 0.4 : 1,
                                  }}
                                >
                                  <CheckCircle size={11} />
                                  Resolver
                                </button>
                              </>
                            ) : (
                              /* ── Resolver binario ── */
                              <>
                                <button
                                  onClick={() => resolveMarket(market.id, "yes")}
                                  disabled={!!actionLoading}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 5,
                                    padding: "6px 12px", borderRadius: 7, cursor: "pointer",
                                    background: "#dcfce7", color: "#15803d",
                                    border: "1.5px solid #86efac", fontSize: 11, fontWeight: 700,
                                    opacity: actionLoading ? 0.4 : 1,
                                  }}
                                >
                                  <CheckCircle size={11} />
                                  {actionLoading === market.id + "yes" ? "Procesando..." : "SÍ gana"}
                                </button>
                                <button
                                  onClick={() => resolveMarket(market.id, "no")}
                                  disabled={!!actionLoading}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 5,
                                    padding: "6px 12px", borderRadius: 7, cursor: "pointer",
                                    background: "#ffe4e6", color: "#be123c",
                                    border: "1.5px solid #fca5a5", fontSize: 11, fontWeight: 700,
                                    opacity: actionLoading ? 0.4 : 1,
                                  }}
                                >
                                  <XCircle size={11} />
                                  {actionLoading === market.id + "no" ? "Procesando..." : "NO gana"}
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => {
                                if (editingMarketId === market.id) {
                                  setEditingMarketId(null);
                                } else {
                                  setEditingMarketId(market.id);
                                  // Convertir closes_at a formato datetime-local
                                  const dt = market.closes_at
                                    ? new Date(market.closes_at).toISOString().slice(0, 16)
                                    : "";
                                  setEditMarketForm({
                                    title:       market.title,
                                    closes_at:   dt,
                                    yes_odds:    market.yes_odds,
                                    no_odds:     market.no_odds,
                                    yes_percent: market.yes_percent ?? 50,
                                  });
                                }
                              }}
                              style={{
                                display: "flex", alignItems: "center", gap: 5,
                                padding: "6px 12px", borderRadius: 7, cursor: "pointer",
                                background: editingMarketId === market.id ? "#eff6ff" : "#f8fafc",
                                color: editingMarketId === market.id ? "#2563eb" : "#64748b",
                                border: `1.5px solid ${editingMarketId === market.id ? "#93c5fd" : "#e8ecf0"}`,
                                fontSize: 11, fontWeight: 700,
                              }}
                            >
                              <Pencil size={11} />
                              {editingMarketId === market.id ? "Cancelar" : "Editar"}
                            </button>
                            <button
                              onClick={() => deleteMarket(market.id)}
                              disabled={!!actionLoading}
                              style={{
                                marginLeft: "auto", padding: "6px 8px", borderRadius: 7,
                                border: "1px solid #e8ecf0", background: "#fff",
                                cursor: "pointer", color: "#94a3b8",
                              }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#be123c"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#fca5a5"; (e.currentTarget as HTMLButtonElement).style.background = "#ffe4e6"; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#e8ecf0"; (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => deleteMarket(market.id)}
                            style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#94a3b8" }}
                          >
                            <Trash2 size={12} /> Eliminar
                          </button>
                        )}

                        {/* ── Form de edición inline ── */}
                        {editingMarketId === market.id && (
                          <div style={{ marginTop: 14, padding: "14px 16px", background: "#eff6ff", borderRadius: 10, border: "1.5px solid #93c5fd", display: "flex", flexDirection: "column", gap: 12 }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: "#1e40af", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                              Editar mercado
                            </p>
                            {/* Título */}
                            <div>
                              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Título</label>
                              <textarea
                                rows={2}
                                value={editMarketForm.title}
                                onChange={(e) => setEditMarketForm({ ...editMarketForm, title: e.target.value })}
                                style={{ width: "100%", border: "1.5px solid #bfdbfe", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#0f172a", background: "#fff", resize: "none", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                              />
                            </div>
                            {/* Fecha cierre + cuotas + % */}
                            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 10 }}>
                              <div>
                                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Fecha cierre</label>
                                <input type="datetime-local" value={editMarketForm.closes_at}
                                  onChange={(e) => setEditMarketForm({ ...editMarketForm, closes_at: e.target.value })}
                                  style={{ width: "100%", border: "1.5px solid #bfdbfe", borderRadius: 8, padding: "7px 10px", fontSize: 12, color: "#0f172a", background: "#fff", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                                />
                              </div>
                              <div>
                                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#15803d", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Cuota SÍ</label>
                                <input type="number" step="0.01" min="1" value={editMarketForm.yes_odds}
                                  onChange={(e) => setEditMarketForm({ ...editMarketForm, yes_odds: parseFloat(e.target.value) })}
                                  style={{ width: "100%", border: "1.5px solid #86efac", borderRadius: 8, padding: "7px 10px", fontSize: 13, fontWeight: 700, color: "#15803d", background: "#dcfce7", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                                />
                              </div>
                              <div>
                                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#be123c", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Cuota NO</label>
                                <input type="number" step="0.01" min="1" value={editMarketForm.no_odds}
                                  onChange={(e) => setEditMarketForm({ ...editMarketForm, no_odds: parseFloat(e.target.value) })}
                                  style={{ width: "100%", border: "1.5px solid #fca5a5", borderRadius: 8, padding: "7px 10px", fontSize: 13, fontWeight: 700, color: "#be123c", background: "#ffe4e6", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                                />
                              </div>
                              <div>
                                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>% SÍ</label>
                                <input type="number" min="1" max="99" value={editMarketForm.yes_percent}
                                  onChange={(e) => setEditMarketForm({ ...editMarketForm, yes_percent: parseInt(e.target.value) })}
                                  style={{ width: "100%", border: "1.5px solid #bfdbfe", borderRadius: 8, padding: "7px 10px", fontSize: 13, color: "#0f172a", background: "#fff", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                                />
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                onClick={() => updateMarket(market.id)}
                                disabled={actionLoading === market.id + "edit"}
                                style={{
                                  display: "flex", alignItems: "center", gap: 5,
                                  padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer",
                                  background: "#2563eb", color: "#fff", fontSize: 12, fontWeight: 700,
                                  opacity: actionLoading === market.id + "edit" ? 0.5 : 1,
                                }}
                              >
                                <CheckCircle size={12} />
                                {actionLoading === market.id + "edit" ? "Guardando..." : "Guardar cambios"}
                              </button>
                              <button
                                onClick={() => setEditingMarketId(null)}
                                style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 12px", borderRadius: 8, border: "1px solid #bfdbfe", background: "#fff", color: "#64748b", fontSize: 12, cursor: "pointer" }}
                              >
                                <X size={12} /> Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ══ USUARIOS ══ */}
          {tab === "users" && (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8ecf0", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <div style={{ padding: "16px 22px", borderBottom: "1px solid #f0f4f8", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>Usuarios registrados</h3>
                  <span style={{ fontSize: 11, color: "#64748b", background: "#f0f4f8", padding: "3px 10px", borderRadius: 20, fontWeight: 600 }}>{users.length} total</span>
                </div>
                <div style={{ position: "relative", minWidth: 220 }}>
                  <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <circle cx={11} cy={11} r={8}/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Buscar usuario..."
                    style={{
                      paddingLeft: 30, paddingRight: 12, paddingTop: 7, paddingBottom: 7,
                      fontSize: 12, border: "1.5px solid #e8ecf0", borderRadius: 8,
                      outline: "none", background: "#f8fafc", color: "#0f172a", width: "100%",
                      boxSizing: "border-box",
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#2563eb"; e.currentTarget.style.background = "#fff"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#e8ecf0"; e.currentTarget.style.background = "#f8fafc"; }}
                  />
                </div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e8ecf0" }}>
                    {[
                      { label: "Usuario / Email", align: "left" },
                      { label: "Etiquetas", align: "left" },
                      { label: "Saldo", align: "right" },
                      { label: "Ganado", align: "right" },
                      { label: "Invertido", align: "right" },
                      { label: "Registro", align: "right" },
                      { label: "Acciones", align: "right" },
                    ].map(({ label, align }) => (
                      <th key={label} style={{ padding: "11px 18px", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: align as any }}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.filter((u) => {
                    const q = userSearch.toLowerCase();
                    return (u.username || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
                  }).map((u, i) => {
                    const isWhale   = (u.total_bet || 0) > 10_000;
                    const isSharper = (u.total_won || 0) > (u.total_bet || 0) && (u.total_bet || 0) > 0;
                    const lastBet   = lastBetByUser[u.id];
                    const isDormant = !lastBet || (Date.now() - new Date(lastBet).getTime()) > 5 * 24 * 60 * 60 * 1000;
                    return (
                      <React.Fragment key={u.id}>
                      <tr style={{ borderBottom: "1px solid #f8fafc", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: "50%",
                              background: `hsl(${(u.username?.charCodeAt(0) ?? 0) * 7 % 360}, 65%, 55%)`,
                              flexShrink: 0,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              color: "#fff", fontSize: 11, fontWeight: 700,
                            }}>
                              {initials(u.username || "")}
                            </div>
                            <div>
                              <p style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: 0 }}>{u.username || "—"}</p>
                              <p style={{ fontSize: 11, color: "#2563eb", margin: "2px 0 0", fontWeight: 500 }}>{u.email || "—"}</p>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {isWhale && (
                              <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: "#1e3a5f", color: "#e0f2fe", letterSpacing: "0.03em" }}>
                                🐋 Ballena
                              </span>
                            )}
                            {isSharper && (
                              <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: "#fef3c7", color: "#92400e", letterSpacing: "0.03em" }}>
                                🎯 Sharper
                              </span>
                            )}
                            {isDormant && (
                              <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: "#f1f5f9", color: "#64748b", letterSpacing: "0.03em" }}>
                                💤 Dormido
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right" }}>
                          <span className="admin-num" style={{ fontSize: 13, fontWeight: 600, color: "#059669", background: "#dcfce7", padding: "3px 8px", borderRadius: 6 }}>
                            ${(u.balance_mxn || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="admin-num" style={{ padding: "12px 16px", textAlign: "right", fontSize: 12, color: "#2563eb", fontWeight: 600 }}>
                          ${(u.total_won || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontSize: 12, color: "#64748b", fontVariantNumeric: "tabular-nums" }}>
                          ${(u.total_bet || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontSize: 11, color: "#94a3b8" }}>
                          {new Date(u.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right" }}>
                          <button
                            onClick={() => {
                              if (adjustingUserId === u.id) {
                                setAdjustingUserId(null);
                                setAdjustForm({ amount: "", reason: "" });
                              } else {
                                setAdjustingUserId(u.id);
                                setAdjustForm({ amount: "", reason: "" });
                              }
                            }}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              padding: "5px 10px", borderRadius: 7, cursor: "pointer",
                              background: adjustingUserId === u.id ? "#eff6ff" : "#f8fafc",
                              color: adjustingUserId === u.id ? "#2563eb" : "#64748b",
                              border: `1px solid ${adjustingUserId === u.id ? "#93c5fd" : "#e8ecf0"}`,
                              fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
                            }}
                          >
                            <DollarSign size={11} />
                            {adjustingUserId === u.id ? "Cancelar" : "Ajustar"}
                          </button>
                        </td>
                      </tr>
                      {adjustingUserId === u.id && (
                        <tr style={{ background: "#f0f9ff" }}>
                          <td colSpan={7} style={{ padding: "0 16px 14px" }}>
                            <div style={{ background: "#eff6ff", border: "1.5px solid #93c5fd", borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                              <p style={{ fontSize: 11, fontWeight: 700, color: "#1e40af", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                Ajuste manual de balance — {u.username}
                                <span style={{ fontWeight: 400, textTransform: "none", marginLeft: 8, color: "#64748b" }}>
                                  Saldo actual: <strong style={{ color: "#059669" }}>${(u.balance_mxn || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN</strong>
                                </span>
                              </p>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 10, alignItems: "flex-end" }}>
                                <div>
                                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
                                    Monto MXN (+ crédito / − débito)
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={adjustForm.amount}
                                    onChange={(e) => setAdjustForm({ ...adjustForm, amount: e.target.value })}
                                    placeholder="Ej: 100 o -50"
                                    style={{ width: "100%", border: "1.5px solid #bfdbfe", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 700, color: "#0f172a", background: "#fff", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                                  />
                                </div>
                                <div>
                                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
                                    Motivo (aparece en historial)
                                  </label>
                                  <input
                                    type="text"
                                    value={adjustForm.reason}
                                    onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                                    placeholder="Ej: Compensación por error, bono de bienvenida..."
                                    style={{ width: "100%", border: "1.5px solid #bfdbfe", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#0f172a", background: "#fff", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                                  />
                                </div>
                                <button
                                  onClick={() => adjustBalance(u.id, u.username)}
                                  disabled={actionLoading === u.id + "adjust"}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 5,
                                    padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                                    background: "#2563eb", color: "#fff", fontSize: 12, fontWeight: 700,
                                    whiteSpace: "nowrap", opacity: actionLoading === u.id + "adjust" ? 0.5 : 1,
                                  }}
                                >
                                  {parseFloat(adjustForm.amount) >= 0
                                    ? <PlusCircle  size={13} />
                                    : <MinusCircle size={13} />}
                                  {actionLoading === u.id + "adjust" ? "Aplicando..." : "Aplicar ajuste"}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ══ CREAR MERCADO ══ */}
          {tab === "create" && (
            <div style={{ maxWidth: 640 }}>
              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8ecf0", padding: 28, display: "flex", flexDirection: "column", gap: 22, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>

                {/* ── Plantillas rápidas ── */}
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                    Plantilla rápida
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {[
                      { label: "🔴 En Vivo · Binario",    preset: { market_type: "binary"   as const, is_trending: true,  category: "Deportes",    description: "En Vivo", title: "¿Ganará el equipo local este partido?" } },
                      { label: "⚡ Esports · Binario",     preset: { market_type: "binary"   as const, is_trending: false, category: "Deportes",    description: "Esports", title: "¿Ganará [Equipo] el Juego 3?" } },
                      { label: "🗳️ Elecciones · Múltiple", preset: { market_type: "multiple" as const, is_trending: false, category: "Elecciones",  description: "Elecciones", title: "¿Quién ganará las elecciones?" } },
                      { label: "₿ Precio · Binario",       preset: { market_type: "binary"   as const, is_trending: false, category: "Finanzas",    description: "Bitcoin", title: "¿Bitcoin superará los $X,000 USD esta semana?" } },
                      { label: "📊 Rango · Scalar",        preset: { market_type: "scalar"   as const, is_trending: false, category: "Finanzas",    description: "Precio",  title: "¿En cuánto cerrará el precio de X?" } },
                      { label: "🎭 Entretenimiento",        preset: { market_type: "binary"   as const, is_trending: false, category: "Entretenimiento", description: "", title: "" } },
                    ].map(({ label, preset }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setNewMarket((prev) => ({ ...prev, ...preset }))}
                        style={{
                          padding: "6px 12px", borderRadius: 8, border: "1.5px solid #e8ecf0",
                          background: "#f8fafc", color: "#374151", fontSize: 12, fontWeight: 600,
                          cursor: "pointer", fontFamily: "inherit", transition: "border-color .15s",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#2563eb"; (e.currentTarget as HTMLButtonElement).style.color = "#1d4ed8"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#e8ecf0"; (e.currentTarget as HTMLButtonElement).style.color = "#374151"; }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ height: 1, background: "#e8ecf0" }} />

                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                    Título de la predicción *
                  </label>
                  <textarea
                    rows={2}
                    value={newMarket.title}
                    onChange={(e) => setNewMarket({ ...newMarket, title: e.target.value })}
                    placeholder='¿Trump dirá "guerra" en un discurso esta semana?'
                    style={{
                      width: "100%", border: "1.5px solid #e8ecf0", borderRadius: 9,
                      padding: "10px 14px", fontSize: 13, color: "#0f172a",
                      background: "#f8fafc", resize: "none", outline: "none",
                      boxSizing: "border-box", fontFamily: "inherit", transition: "border-color 0.15s",
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#2563eb"; e.currentTarget.style.background = "#fff"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#e8ecf0"; e.currentTarget.style.background = "#f8fafc"; }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                      Sujeto *
                    </label>
                    <input
                      value={newMarket.subject_name}
                      onChange={(e) => setNewMarket({ ...newMarket, subject_name: e.target.value })}
                      placeholder="Donald Trump"
                      style={{
                        width: "100%", border: "1.5px solid #e8ecf0", borderRadius: 9,
                        padding: "9px 14px", fontSize: 13, color: "#0f172a",
                        background: "#f8fafc", outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "#2563eb"; e.currentTarget.style.background = "#fff"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "#e8ecf0"; e.currentTarget.style.background = "#f8fafc"; }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                      Categoría
                    </label>
                    <select
                      value={newMarket.category}
                      onChange={(e) => setNewMarket({ ...newMarket, category: e.target.value })}
                      style={{
                        width: "100%", border: "1.5px solid #e8ecf0", borderRadius: 9,
                        padding: "9px 14px", fontSize: 13, color: "#0f172a",
                        background: "#f8fafc", outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                      }}
                    >
                      {["Política","Negocios","Entretenimiento","Deportes","Tech","Finanzas","Cultura","Elecciones"].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Foto del sujeto */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                      Foto del sujeto
                    </label>
                    {wikiLoading && (
                      <span style={{ fontSize: 10, color: "#2563eb", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", border: "1.5px solid #2563eb", borderTopColor: "transparent", animation: "spin 0.6s linear infinite" }} />
                        Buscando en Wikipedia…
                      </span>
                    )}
                    {!wikiLoading && wikiSource && newMarket.subject_photo_url && (
                      <span style={{ fontSize: 10, color: "#15803d", fontWeight: 600 }}>
                        ✓ Encontrado en Wikipedia {wikiSource === "es" ? "ES" : "EN"}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {/* Preview */}
                    <div style={{
                      width: 52, height: 52, borderRadius: 12, flexShrink: 0, overflow: "hidden",
                      border: `1.5px solid ${newMarket.subject_photo_url ? "#86efac" : "#e8ecf0"}`,
                      background: "#f1f5f9",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, color: "#94a3b8", fontWeight: 700,
                      transition: "border-color 0.2s",
                      position: "relative",
                    }}>
                      {wikiLoading && (
                        <div style={{
                          position: "absolute", inset: 0, background: "rgba(255,255,255,0.7)",
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                        }}>⏳</div>
                      )}
                      {newMarket.subject_photo_url.trim() ? (
                        <img
                          src={newMarket.subject_photo_url.trim()}
                          alt=""
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        newMarket.subject_name
                          ? newMarket.subject_name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()
                          : "📷"
                      )}
                    </div>

                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                      <input
                        type="url"
                        value={newMarket.subject_photo_url}
                        onChange={(e) => {
                          setNewMarket({ ...newMarket, subject_photo_url: e.target.value });
                          if (!e.target.value.trim()) setWikiSource(null);
                        }}
                        placeholder="Se busca automático al escribir el nombre…"
                        style={{
                          width: "100%", border: "1.5px solid #e8ecf0", borderRadius: 9,
                          padding: "9px 14px", fontSize: 12, color: "#0f172a",
                          background: "#f8fafc", outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = "#2563eb"; e.currentTarget.style.background = "#fff"; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = "#e8ecf0"; e.currentTarget.style.background = "#f8fafc"; }}
                      />
                      <div style={{ display: "flex", gap: 6 }}>
                        {/* Re-buscar en Wikipedia */}
                        <button
                          type="button"
                          disabled={wikiLoading || !newMarket.subject_name.trim()}
                          onClick={async () => {
                            if (wikiLoading || !newMarket.subject_name.trim()) return;
                            setWikiSource(null);
                            setNewMarket((prev) => ({ ...prev, subject_photo_url: "" }));
                            setWikiLoading(true);
                            const url = await fetchWikiPhoto(newMarket.subject_name.trim());
                            setNewMarket((prev) => ({ ...prev, subject_photo_url: url ?? "" }));
                            if (url) setWikiSource("es");
                            setWikiLoading(false);
                          }}
                          style={{
                            padding: "5px 10px", borderRadius: 7, border: "1.5px solid #e8ecf0",
                            background: "#f8fafc", color: "#475569", fontSize: 11, fontWeight: 600,
                            cursor: wikiLoading || !newMarket.subject_name.trim() ? "not-allowed" : "pointer",
                            opacity: wikiLoading || !newMarket.subject_name.trim() ? 0.5 : 1,
                            fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4,
                          }}
                        >
                          🔍 Re-buscar Wikipedia
                        </button>
                        {newMarket.subject_photo_url && (
                          <button
                            type="button"
                            onClick={() => { setNewMarket({ ...newMarket, subject_photo_url: "" }); setWikiSource(null); }}
                            style={{
                              padding: "5px 10px", borderRadius: 7, border: "1.5px solid #fca5a5",
                              background: "#fff5f5", color: "#be123c", fontSize: 11, fontWeight: 600,
                              cursor: "pointer", fontFamily: "inherit",
                            }}
                          >
                            ✕ Quitar foto
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
                    Se busca automáticamente en Wikipedia al escribir el nombre. Puedes pegar otra URL o dejarlo vacío para usar las iniciales.
                  </p>
                </div>

                {/* Tipo de mercado */}
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                    Tipo de mercado
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(["binary", "multiple", "scalar"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setNewMarket({ ...newMarket, market_type: t })}
                        style={{
                          flex: 1, padding: "9px 0", borderRadius: 9, border: "1.5px solid",
                          borderColor: newMarket.market_type === t ? "#2563eb" : "#e8ecf0",
                          background: newMarket.market_type === t ? "#eff6ff" : "#f8fafc",
                          color: newMarket.market_type === t ? "#1d4ed8" : "#64748b",
                          fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                        }}
                      >
                        {t === "binary" ? "✅ Sí / No" : t === "multiple" ? "🔢 Opción múltiple" : "📊 Scalar"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Opciones dinámicas (solo para múltiple) */}
                {newMarket.market_type === "multiple" && (
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                      Opciones (mínimo 2) *
                    </label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {multipleOptions.map((opt, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                          {/* Avatar preview de la opción */}
                          <div style={{
                            width: 42, height: 42, borderRadius: 10, flexShrink: 0, overflow: "hidden",
                            border: `1.5px solid ${opt.photo_url ? "#86efac" : "#e8ecf0"}`,
                            background: "#f1f5f9", display: "flex", alignItems: "center",
                            justifyContent: "center", fontSize: 11, color: "#94a3b8",
                            fontWeight: 700, position: "relative", marginTop: 1,
                          }}>
                            {opt.loading && (
                              <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                                ⏳
                              </div>
                            )}
                            {opt.photo_url ? (
                              <img src={opt.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                              />
                            ) : (
                              opt.label
                                ? opt.label.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()
                                : (i + 1).toString()
                            )}
                          </div>

                          {/* Nombre + foto URL */}
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                            <input
                              value={opt.label}
                              onChange={(e) => {
                                const next = multipleOptions.map((o, j) =>
                                  j === i ? { ...o, label: e.target.value } : o
                                );
                                setMultipleOptions(next);
                                fetchOptionPhoto(i, e.target.value);
                              }}
                              placeholder={`Opción ${i + 1}${i < 2 ? " *" : ""} — ej. Trump, AMLO…`}
                              style={{
                                width: "100%", border: "1.5px solid #e8ecf0", borderRadius: 9,
                                padding: "8px 12px", fontSize: 13, color: "#0f172a",
                                background: "#f8fafc", outline: "none", fontFamily: "inherit",
                                boxSizing: "border-box",
                              }}
                            />
                            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                              <input
                                type="url"
                                value={opt.photo_url}
                                onChange={(e) => {
                                  setMultipleOptions(multipleOptions.map((o, j) =>
                                    j === i ? { ...o, photo_url: e.target.value } : o
                                  ));
                                }}
                                placeholder="URL foto (auto-Wikipedia al escribir nombre)"
                                style={{
                                  flex: 1, border: "1.5px solid #e8ecf0", borderRadius: 7,
                                  padding: "6px 10px", fontSize: 11, color: "#475569",
                                  background: "#f8fafc", outline: "none", fontFamily: "inherit",
                                  boxSizing: "border-box",
                                }}
                              />
                              {opt.photo_url && (
                                <button type="button"
                                  onClick={() => setMultipleOptions(multipleOptions.map((o, j) =>
                                    j === i ? { ...o, photo_url: "" } : o
                                  ))}
                                  style={{ padding: "5px 7px", borderRadius: 6, border: "1px solid #fca5a5", background: "#fff5f5", color: "#be123c", cursor: "pointer", fontSize: 11 }}
                                >✕</button>
                              )}
                            </div>
                          </div>

                          {/* Eliminar opción */}
                          {multipleOptions.length > 2 && (
                            <button
                              type="button"
                              onClick={() => setMultipleOptions(multipleOptions.filter((_, j) => j !== i))}
                              style={{ padding: "8px 10px", borderRadius: 7, border: "1px solid #fca5a5", background: "#fff5f5", color: "#be123c", cursor: "pointer", fontSize: 12, fontWeight: 700, marginTop: 1 }}
                            >✕</button>
                          )}
                        </div>
                      ))}

                      {multipleOptions.length < 8 && (
                        <button
                          type="button"
                          onClick={() => setMultipleOptions([...multipleOptions, { label: "", photo_url: "", loading: false }])}
                          style={{
                            padding: "8px", borderRadius: 9, border: "1.5px dashed #cbd5e1",
                            background: "#f8fafc", color: "#64748b", cursor: "pointer",
                            fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                          }}
                        >
                          + Agregar opción
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Campos escalares (solo para scalar) */}
                {newMarket.market_type === "scalar" && (
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                      Rango del valor *
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>Mínimo</label>
                        <input
                          type="number"
                          value={newMarket.scalar_min}
                          onChange={(e) => setNewMarket({ ...newMarket, scalar_min: parseFloat(e.target.value) || 0 })}
                          style={{ width: "100%", border: "1.5px solid #e8ecf0", borderRadius: 9, padding: "9px 14px", fontSize: 13, color: "#0f172a", background: "#f8fafc", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>Máximo</label>
                        <input
                          type="number"
                          value={newMarket.scalar_max}
                          onChange={(e) => setNewMarket({ ...newMarket, scalar_max: parseFloat(e.target.value) || 0 })}
                          style={{ width: "100%", border: "1.5px solid #e8ecf0", borderRadius: 9, padding: "9px 14px", fontSize: 13, color: "#0f172a", background: "#f8fafc", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>Unidad *</label>
                        <input
                          type="text"
                          placeholder="%, MXN, pts…"
                          value={newMarket.scalar_unit}
                          onChange={(e) => setNewMarket({ ...newMarket, scalar_unit: e.target.value })}
                          style={{ width: "100%", border: "1.5px solid #e8ecf0", borderRadius: 9, padding: "9px 14px", fontSize: 13, color: "#0f172a", background: "#f8fafc", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                        />
                      </div>
                    </div>
                    <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
                      Los usuarios apuestan eligiendo un rango dentro de [{newMarket.scalar_min} – {newMarket.scalar_max}] {newMarket.scalar_unit}. Cuota fija: 2x.
                    </p>
                  </div>
                )}

                {/* Cuotas y % inicial (solo para binario) */}
                {newMarket.market_type === "binary" && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#15803d", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                          Cuota SÍ
                        </label>
                        <input type="number" step="0.1" min="1" value={newMarket.yes_odds}
                          onChange={(e) => setNewMarket({ ...newMarket, yes_odds: parseFloat(e.target.value) })}
                          style={{ width: "100%", border: "1.5px solid #86efac", borderRadius: 9, padding: "9px 14px", fontSize: 14, fontWeight: 800, color: "#15803d", background: "#dcfce7", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#be123c", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                          Cuota NO
                        </label>
                        <input type="number" step="0.1" min="1" value={newMarket.no_odds}
                          onChange={(e) => setNewMarket({ ...newMarket, no_odds: parseFloat(e.target.value) })}
                          style={{ width: "100%", border: "1.5px solid #fca5a5", borderRadius: 9, padding: "9px 14px", fontSize: 14, fontWeight: 800, color: "#be123c", background: "#ffe4e6", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                          % inicial SÍ
                        </label>
                        <input type="number" min="1" max="99" value={newMarket.yes_percent}
                          onChange={(e) => setNewMarket({ ...newMarket, yes_percent: parseInt(e.target.value), no_percent: 100 - parseInt(e.target.value) })}
                          style={{ width: "100%", border: "1.5px solid #e8ecf0", borderRadius: 9, padding: "9px 14px", fontSize: 13, color: "#0f172a", background: "#f8fafc", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                        />
                      </div>
                    </div>

                    {/* Probability preview */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
                        <span style={{ color: "#15803d", fontWeight: 700 }}>SÍ {newMarket.yes_percent}%</span>
                        <span style={{ color: "#be123c", fontWeight: 700 }}>NO {newMarket.no_percent}%</span>
                      </div>
                      <div style={{ display: "flex", height: 8, borderRadius: 6, overflow: "hidden" }}>
                        <div style={{ background: "#22c55e", width: `${newMarket.yes_percent}%`, transition: "width 0.3s" }} />
                        <div style={{ background: "#f43f5e", width: `${newMarket.no_percent}%`, transition: "width 0.3s" }} />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                    Fecha de cierre *
                  </label>
                  <input type="datetime-local" value={newMarket.closes_at}
                    onChange={(e) => setNewMarket({ ...newMarket, closes_at: e.target.value })}
                    style={{ width: "100%", border: "1.5px solid #e8ecf0", borderRadius: 9, padding: "9px 14px", fontSize: 13, color: "#0f172a", background: "#f8fafc", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                  />
                </div>

                {/* Subcategoría / Contexto */}
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                    Subcategoría / Contexto (opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={newMarket.description}
                    onChange={(e) => setNewMarket({ ...newMarket, description: e.target.value })}
                    placeholder="Subcategoría corta (ej: Bitcoin, LoL, Esports, Mensual) o contexto del mercado..."
                    style={{ width: "100%", border: "1.5px solid #e8ecf0", borderRadius: 9, padding: "9px 14px", fontSize: 13, color: "#0f172a", background: "#f8fafc", outline: "none", boxSizing: "border-box", fontFamily: "inherit", resize: "vertical" }}
                  />
                  <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 5 }}>
                    Si es ≤ 25 caracteres se muestra como etiqueta en el card (ej: <strong style={{ color: "#374151" }}>Bitcoin</strong>, <strong style={{ color: "#374151" }}>LoL</strong>). Si es más largo se usa solo como contexto interno.
                  </p>
                </div>

                {/* Normas */}
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#d97706", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                    Normas de resolución (opcional)
                  </label>
                  <textarea
                    rows={3}
                    value={newMarket.rules}
                    onChange={(e) => setNewMarket({ ...newMarket, rules: e.target.value })}
                    placeholder="¿Cómo se resuelve este mercado? Ej: Se resolverá SÍ si en los próximos 30 días..."
                    style={{ width: "100%", border: "1.5px solid #fde68a", borderRadius: 9, padding: "9px 14px", fontSize: 13, color: "#92400e", background: "#fffbeb", outline: "none", boxSizing: "border-box", fontFamily: "inherit", resize: "vertical" }}
                  />
                </div>

                {/* En Vivo toggle */}
                <div onClick={() => setNewMarket({ ...newMarket, is_trending: !newMarket.is_trending })} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <div style={{ width: 40, height: 22, borderRadius: 11, position: "relative", background: newMarket.is_trending ? "#EF4444" : "#e8ecf0", transition: "background 0.2s", flexShrink: 0 }}>
                    <div style={{ position: "absolute", top: 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s", left: newMarket.is_trending ? 21 : 3 }} />
                  </div>
                  <div>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#374151", fontWeight: 600 }}>
                      {newMarket.is_trending
                        ? <><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#EF4444", display: "inline-block" }} />🔴 En Vivo</>
                        : <><Flame size={13} color="#cbd5e1" />Marcar como En Vivo</>}
                    </span>
                    <p style={{ fontSize: 11, color: "#94a3b8", margin: "2px 0 0" }}>Muestra badge LIVE rojo pulsante en el card</p>
                  </div>
                </div>

                <div style={{ height: 1, background: "#e8ecf0" }} />

                {editingDraftId ? (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "#eff6ff", border: "1.5px solid #bfdbfe", borderRadius: 9, padding: "12px 14px" }}>
                    <Sparkles size={13} color="#2563eb" style={{ marginTop: 1, flexShrink: 0 }} />
                    <p style={{ fontSize: 12, color: "#1e40af", margin: 0, lineHeight: 1.6 }}>
                      Editando borrador de IA — al publicar se reemplazará el borrador y quedará visible para todos.{" "}
                      <button
                        onClick={() => { setEditingDraftId(null); setNewMarket({ title: "", subject_name: "", category: "Política", market_type: "binary", yes_odds: 2.0, no_odds: 2.0, yes_percent: 50, no_percent: 50, closes_at: "", is_trending: false, scalar_min: 0, scalar_max: 100, scalar_unit: "", subject_photo_url: "", description: "", rules: "" }); }}
                        style={{ background: "none", border: "none", color: "#2563eb", fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 12, textDecoration: "underline" }}
                      >
                        Cancelar
                      </button>
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 9, padding: "12px 14px" }}>
                    <AlertTriangle size={13} color="#d97706" style={{ marginTop: 1, flexShrink: 0 }} />
                    <p style={{ fontSize: 12, color: "#92400e", margin: 0, lineHeight: 1.6 }}>
                      Una vez creado, el mercado será visible para todos los usuarios inmediatamente.
                    </p>
                  </div>
                )}

                <button
                  onClick={createMarket}
                  disabled={!!actionLoading}
                  style={{
                    width: "100%", padding: "13px", borderRadius: 9,
                    background: editingDraftId ? "#16a34a" : "#1d4ed8", color: "#fff",
                    border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer",
                    opacity: actionLoading ? 0.5 : 1,
                    fontFamily: "inherit", letterSpacing: "-0.01em",
                  }}
                  onMouseEnter={(e) => { if (!actionLoading) (e.currentTarget as HTMLButtonElement).style.background = editingDraftId ? "#15803d" : "#1e40af"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = editingDraftId ? "#16a34a" : "#1d4ed8"; }}
                >
                  {actionLoading === "create" ? "Publicando..." : editingDraftId ? "✓ Publicar mercado" : "Crear mercado"}
                </button>

              </div>
            </div>
          )}

          {/* ══ TESORERÍA ══ */}
          {tab === "treasury" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Header row con botón PDF */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
                    Visibilidad financiera del banco · Fee: <strong style={{ color: "#2563eb" }}>3% por apuesta ganada</strong>
                  </p>
                </div>
                <button
                  onClick={generatePDF}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "9px 18px", borderRadius: 8,
                    background: "#1d4ed8", color: "#fff",
                    border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  <FileText size={13} />
                  Generar Reporte PDF
                </button>
              </div>

              {/* KPIs financieros */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                {[
                  { label: "Total Depósitos",      value: financials?.total_deposits     || 0, color: "#059669", accentBg: "#ecfdf5" },
                  { label: "Volumen Invertido",      value: financials?.total_bets_volume  || 0, color: "#2563eb", accentBg: "#eff6ff" },
                  { label: "Pagado a Ganadores",    value: financials?.total_wins_paid    || 0, color: "#d97706", accentBg: "#fffbeb" },
                  { label: "Net Profit (House)",    value: financials?.net_profit         || 0, color: "#7c3aed", accentBg: "#f5f3ff" },
                  { label: "Fee Realizado (3%)",    value: financials?.house_fee_realized || 0, color: "#0369a1", accentBg: "#f0f9ff" },
                  { label: "Liability (riesgo)",    value: financials?.liability          || 0, color: "#be123c", accentBg: "#fff1f2" },
                  { label: "Total Retirado (aprobado)", value: totalWithdrawn, isMoney: true,  color: "#7c3aed", accentBg: "#fdf4ff" },
                  { label: "Monto pendiente retiro",    value: withdrawals.filter((w) => w.status === "pending").reduce((s: number, w: any) => s + (w.amount || 0), 0), isMoney: true, color: "#d97706", accentBg: "#fffbeb" },
                  { label: "Solicitudes pendientes",    value: pendingWdCount, isMoney: false, color: "#64748b", accentBg: "#f0f4f8" },
                ].map(({ label, value, color, accentBg, isMoney }) => (
                  <div key={label} style={{
                    background: "#fff", borderRadius: 14, border: "1px solid #e8ecf0",
                    padding: "20px 22px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 10px" }}>{label}</p>
                    <p style={{ fontSize: 26, fontWeight: 800, color, margin: 0, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                      {isMoney
                        ? `$${(value as number).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : String(value)}
                    </p>
                    <p style={{ fontSize: 11, color: "#94a3b8", margin: "5px 0 0" }}>{isMoney ? "MXN" : "solicitudes"}</p>
                  </div>
                ))}
              </div>

              {/* Gráfica: volumen diario de apuestas */}
              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8ecf0", padding: "22px 22px 14px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                <div style={{ marginBottom: 18 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>Volumen Diario de Predicciones</h3>
                  <p style={{ fontSize: 11, color: "#94a3b8", margin: "3px 0 0" }}>Últimos 30 días · MXN invertido</p>
                </div>
                {dailyVolume.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={dailyVolume}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtMXN(v)} width={52} />
                      <Tooltip content={<ChartTooltip />} />
                      <Line type="monotone" dataKey="volume" stroke="#2563eb" strokeWidth={2} dot={{ r: 3, fill: "#2563eb" }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "#cbd5e1", fontSize: 13 }}>
                    Sin actividad en los últimos 30 días
                  </div>
                )}
              </div>

              {/* Tabla: estadísticas por categoría */}
              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8ecf0", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid #f0f4f8" }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: 0 }}>Ganancias por Categoría</h3>
                  <p style={{ fontSize: 11, color: "#94a3b8", margin: "3px 0 0" }}>Basado en últimas 50 predicciones</p>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e8ecf0" }}>
                      {["Categoría", "Predicciones", "Volumen MXN", "Fee Generado MXN", "% del Volumen"].map((h, i) => (
                        <th key={h} style={{ padding: "10px 16px", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: i === 0 ? "left" : "right" as any }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {categoryStats.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Sin datos</td></tr>
                    ) : categoryStats.map((c, i) => {
                      const totalVol = categoryStats.reduce((a, x) => a + x.volume, 0);
                      const pct = totalVol > 0 ? ((c.volume / totalVol) * 100).toFixed(1) : "0";
                      return (
                        <tr key={c.category} style={{ borderBottom: "1px solid #f8fafc", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                          <td style={{ padding: "11px 16px", fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{c.category}</td>
                          <td style={{ padding: "11px 16px", textAlign: "right", fontSize: 12, color: "#64748b" }}>{c.count}</td>
                          <td style={{ padding: "11px 16px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
                            ${c.volume.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: "11px 16px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#059669", fontVariantNumeric: "tabular-nums" }}>
                            ${c.fee.toFixed(2)}
                          </td>
                          <td style={{ padding: "11px 16px", textAlign: "right" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                              <div style={{ width: 60, height: 5, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                                <div style={{ width: `${pct}%`, height: "100%", background: "#2563eb", borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: 11, color: "#64748b", fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mercados abiertos con su exposición */}
              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8ecf0", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid #f0f4f8", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: 0 }}>Exposición por Mercado Abierto</h3>
                    <p style={{ fontSize: 11, color: "#94a3b8", margin: "3px 0 0" }}>Pool activo · riesgo del banco por mercado</p>
                  </div>
                  <span style={{ fontSize: 11, background: "#fef3c7", color: "#92400e", fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
                    Liability total: ${(financials?.liability || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
                  </span>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e8ecf0" }}>
                      {[
                        { label: "Mercado", align: "left" },
                        { label: "Categoría", align: "left" },
                        { label: "Pool", align: "right" },
                        { label: "Participantes", align: "center" },
                        { label: "SÍ %", align: "center" },
                        { label: "Odds", align: "center" },
                      ].map(({ label, align }) => (
                        <th key={label} style={{ padding: "10px 16px", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: align as any }}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {markets.filter((m) => m.status === "open").map((m, i) => (
                      <tr key={m.id} style={{ borderBottom: "1px solid #f8fafc", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                        <td style={{ padding: "11px 16px", fontSize: 12, fontWeight: 600, color: "#0f172a", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.title}
                        </td>
                        <td style={{ padding: "11px 16px" }}>
                          <span style={{ fontSize: 10, background: "#f1f5f9", color: "#475569", padding: "2px 7px", borderRadius: 4, fontWeight: 500 }}>{m.category}</span>
                        </td>
                        <td style={{ padding: "11px 16px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
                          ${(m.total_pool || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: "11px 16px", textAlign: "center", fontSize: 12, color: "#64748b" }}>{m.bettor_count || 0}</td>
                        <td style={{ padding: "11px 16px", textAlign: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
                            <div style={{ width: 40, height: 4, background: "#f1f5f9", borderRadius: 2, overflow: "hidden" }}>
                              <div style={{ width: `${m.yes_percent || 50}%`, height: "100%", background: "#22c55e" }} />
                            </div>
                            <span style={{ fontSize: 10, color: "#15803d", fontWeight: 700 }}>{m.yes_percent || 50}%</span>
                          </div>
                        </td>
                        <td style={{ padding: "11px 16px", textAlign: "center", fontSize: 11, color: "#64748b", fontVariantNumeric: "tabular-nums" }}>
                          {m.yes_odds}x / {m.no_odds}x
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ══ SEGURIDAD E INTEGRIDAD FINANCIERA ══ */}
              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8ecf0", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                {/* Header */}
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #f0f4f8", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <ShieldCheck size={17} color="#2563eb" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: 0 }}>Seguridad e Integridad Financiera</h3>
                      <p style={{ fontSize: 11, color: "#94a3b8", margin: "2px 0 0" }}>Compara activo real vs pasivo total — verifica que el casino siempre esté cuadrado</p>
                    </div>
                  </div>
                  <button
                    onClick={runAudit}
                    disabled={auditLoading}
                    style={{
                      display: "flex", alignItems: "center", gap: 7,
                      padding: "9px 18px", borderRadius: 8,
                      background: auditLoading ? "#93c5fd" : "#2563eb",
                      color: "#fff", border: "none", fontSize: 12,
                      fontWeight: 700, cursor: auditLoading ? "not-allowed" : "pointer",
                      transition: "background 0.15s",
                    }}
                  >
                    <ShieldCheck size={13} />
                    {auditLoading ? "Ejecutando…" : "Ejecutar Auditoría Global"}
                  </button>
                </div>

                <div style={{ padding: "20px" }}>
                  {/* Resultado de la última auditoría */}
                  {auditResult ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {/* Alerta de estado */}
                      {auditResult.is_balanced ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 10, background: "#ecfdf5", border: "1.5px solid #6ee7b7" }}>
                          <CheckCircle size={20} color="#059669" />
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 700, color: "#059669", margin: 0 }}>Sistema cuadrado — Casino solvente</p>
                            <p style={{ fontSize: 11, color: "#047857", margin: "2px 0 0" }}>
                              Superávit de <strong>${auditResult.gap.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</strong> MXN sobre el pasivo total
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", borderRadius: 10, background: "#fff1f2", border: "1.5px solid #fca5a5" }}>
                          <AlertTriangle size={20} color="#be123c" style={{ flexShrink: 0, marginTop: 1 }} />
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 700, color: "#be123c", margin: 0 }}>GAP DETECTADO — Revisar urgentemente</p>
                            <p style={{ fontSize: 11, color: "#9f1239", margin: "2px 0 0" }}>
                              El pasivo supera al activo real en <strong>${Math.abs(auditResult.gap).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</strong> MXN
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Tarjetas Activo vs Pasivo */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div style={{ background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: 10, padding: "16px 18px" }}>
                          <p style={{ fontSize: 10, fontWeight: 700, color: "#15803d", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 10px" }}>Dinero Real (Activo)</p>
                          <p style={{ fontSize: 26, fontWeight: 800, color: "#15803d", margin: 0, fontVariantNumeric: "tabular-nums" }}>
                            ${auditResult.dinero_real.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                          </p>
                          <p style={{ fontSize: 10, color: "#4ade80", margin: "4px 0 0" }}>MXN</p>
                          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 5 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                              <span style={{ color: "#64748b" }}>Depósitos Stripe</span>
                              <span style={{ fontWeight: 600, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
                                +${(auditResult.detail.stripe_deposits || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                              <span style={{ color: "#64748b" }}>Retiros aprobados (SPEI)</span>
                              <span style={{ fontWeight: 600, color: "#be123c", fontVariantNumeric: "tabular-nums" }}>
                                −${(auditResult.detail.approved_withdrawals || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div style={{ background: "#faf5ff", border: "1.5px solid #c4b5fd", borderRadius: 10, padding: "16px 18px" }}>
                          <p style={{ fontSize: 10, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 10px" }}>Pasivo Total (Obligaciones)</p>
                          <p style={{ fontSize: 26, fontWeight: 800, color: "#7c3aed", margin: 0, fontVariantNumeric: "tabular-nums" }}>
                            ${auditResult.pasivo_total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                          </p>
                          <p style={{ fontSize: 10, color: "#a78bfa", margin: "4px 0 0" }}>MXN</p>
                          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 5 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                              <span style={{ color: "#64748b" }}>Saldos de usuarios</span>
                              <span style={{ fontWeight: 600, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
                                ${(auditResult.detail.sum_balances || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                              <span style={{ color: "#64748b" }}>Retiros pendientes</span>
                              <span style={{ fontWeight: 600, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
                                ${(auditResult.detail.pending_withdrawals || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                              <span style={{ color: "#64748b" }}>Liability posiciones abiertas</span>
                              <span style={{ fontWeight: 600, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
                                ${(auditResult.detail.pending_bets_liability || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Gap visual */}
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "12px 16px", borderRadius: 8,
                        background: auditResult.is_balanced ? "#ecfdf5" : "#fff1f2",
                        border: `1px solid ${auditResult.is_balanced ? "#6ee7b7" : "#fca5a5"}`,
                      }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Diferencia (Activo − Pasivo)</span>
                        <span style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: auditResult.is_balanced ? "#059669" : "#be123c" }}>
                          {auditResult.gap >= 0 ? "+" : ""}${auditResult.gap.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN
                        </span>
                      </div>

                      <p style={{ fontSize: 10, color: "#94a3b8", margin: 0 }}>
                        Última auditoría: {new Date(auditResult.run_at || Date.now()).toLocaleString("es-MX")} · por {auditResult.run_by}
                      </p>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8" }}>
                      <ShieldCheck size={36} color="#cbd5e1" style={{ marginBottom: 12 }} />
                      <p style={{ fontSize: 13, margin: "0 0 4px" }}>Sin auditorías ejecutadas</p>
                      <p style={{ fontSize: 11, margin: 0 }}>Presiona "Ejecutar Auditoría Global" para verificar la integridad financiera</p>
                    </div>
                  )}
                </div>

                {/* Histórico de auditorías */}
                {auditLog.length > 0 && (
                  <div style={{ borderTop: "1px solid #f1f5f9" }}>
                    <div style={{ padding: "12px 20px", background: "#f8fafc" }}>
                      <h4 style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>
                        Histórico de Auditorías ({auditLog.length})
                      </h4>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e8ecf0" }}>
                          {["Fecha", "Activo Real", "Pasivo Total", "Diferencia", "Estado"].map((h, i) => (
                            <th key={h} style={{ padding: "9px 16px", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: i === 0 ? "left" : "right" as any }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {auditLog.map((a, i) => (
                          <tr key={a.id} style={{ borderBottom: "1px solid #f8fafc", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                            <td style={{ padding: "10px 16px", fontSize: 11, color: "#475569" }}>
                              {new Date(a.run_at).toLocaleString("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </td>
                            <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "#059669", fontVariantNumeric: "tabular-nums" }}>
                              ${(a.dinero_real || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "#7c3aed", fontVariantNumeric: "tabular-nums" }}>
                              ${(a.pasivo_total || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: a.is_balanced ? "#059669" : "#be123c" }}>
                              {a.gap >= 0 ? "+" : ""}${(a.gap || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: "10px 16px", textAlign: "right" }}>
                              {a.is_balanced ? (
                                <span style={{ fontSize: 10, background: "#dcfce7", color: "#15803d", fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>CUADRADO</span>
                              ) : (
                                <span style={{ fontSize: 10, background: "#fee2e2", color: "#be123c", fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>GAP</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Tabla: retiros de usuarios */}
              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8ecf0", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid #f0f4f8", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: 0 }}>Retiros de Usuarios</h3>
                    <p style={{ fontSize: 11, color: "#94a3b8", margin: "3px 0 0" }}>Últimas solicitudes · todos los estados</p>
                  </div>
                  {pendingWdCount > 0 && (
                    <span style={{ fontSize: 11, background: "#fef3c7", color: "#92400e", fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
                      {pendingWdCount} pendiente{pendingWdCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {withdrawals.length === 0 ? (
                  <div style={{ padding: "32px 20px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                    No hay solicitudes de retiro aún
                  </div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e8ecf0" }}>
                        {["Usuario", "Monto", "Estado", "Banco", "Fecha"].map((h, i) => (
                          <th key={h} style={{ padding: "10px 16px", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: i > 0 ? "right" as any : "left" }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {withdrawals.slice(0, 20).map((w: any, i: number) => {
                        const details = w.bank_details || {};
                        const st = w.status === "approved"
                          ? { bg: "#dcfce7", color: "#166534", label: "Pagado"    }
                          : w.status === "rejected"
                          ? { bg: "#fee2e2", color: "#991b1b", label: "Rechazado" }
                          : { bg: "#fef3c7", color: "#92400e", label: "Pendiente" };
                        return (
                          <tr key={w.id} style={{ borderBottom: "1px solid #f8fafc", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                            <td style={{ padding: "11px 16px", fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                              {w.profiles?.username || "—"}
                            </td>
                            <td style={{ padding: "11px 16px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
                              ${(w.amount || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
                            </td>
                            <td style={{ padding: "11px 16px", textAlign: "right" }}>
                              <span style={{ fontSize: 10, background: st.bg, color: st.color, fontWeight: 700, padding: "3px 8px", borderRadius: 20 }}>
                                {st.label}
                              </span>
                            </td>
                            <td style={{ padding: "11px 16px", textAlign: "right", fontSize: 11, color: "#64748b" }}>
                              {details.bank_name || "—"} · <span style={{ fontFamily: "monospace" }}>{details.clabe ? `****${details.clabe.slice(-4)}` : "—"}</span>
                            </td>
                            <td style={{ padding: "11px 16px", textAlign: "right", fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap" }}>
                              {new Date(w.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

            </div>
          )}

          {/* ══ AUDIT LOG ══ */}
          {tab === "auditlog" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Encabezado + botón ejecutar auditoría */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
                    Historial completo de auditorías financieras · cada ejecución manual o automática
                  </p>
                </div>
                <button
                  onClick={runAudit}
                  disabled={auditLoading}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "9px 18px", borderRadius: 8,
                    background: auditLoading ? "#93c5fd" : "#2563eb",
                    color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: auditLoading ? "not-allowed" : "pointer",
                  }}
                >
                  <ShieldCheck size={13} />
                  {auditLoading ? "Ejecutando..." : "Ejecutar auditoría ahora"}
                </button>
              </div>

              {/* KPIs rápidos del último resultado */}
              {auditLog.length > 0 && (() => {
                const last = auditLog[0];
                return (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
                    {[
                      { label: "Último activo real",   value: `$${(last.dinero_real || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`, color: "#059669", bg: "#ecfdf5", border: "#6ee7b7" },
                      { label: "Último pasivo total",  value: `$${(last.pasivo_total || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`, color: "#7c3aed", bg: "#f5f3ff", border: "#c4b5fd" },
                      { label: "Última diferencia",    value: `${last.gap >= 0 ? "+" : ""}$${(last.gap || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`, color: last.is_balanced ? "#059669" : "#be123c", bg: last.is_balanced ? "#ecfdf5" : "#fff1f2", border: last.is_balanced ? "#6ee7b7" : "#fca5a5" },
                      { label: "Total auditorías",     value: String(auditLog.length), color: "#0369a1", bg: "#f0f9ff", border: "#7dd3fc" },
                    ].map(({ label, value, color, bg, border }) => (
                      <div key={label} style={{ background: "#fff", border: "1px solid #e8ecf0", borderRadius: 14, padding: "18px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 8px" }}>{label}</p>
                        <p style={{ fontSize: 22, fontWeight: 800, color, margin: 0, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{value}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Tabla completa */}
              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8ecf0", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid #f0f4f8", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: 0 }}>Historial de auditorías</h3>
                    <p style={{ fontSize: 11, color: "#94a3b8", margin: "3px 0 0" }}>{auditLog.length} registros · ordenados por fecha descendente</p>
                  </div>
                </div>

                {auditLog.length === 0 ? (
                  <div style={{ padding: "48px 20px", textAlign: "center" }}>
                    <ShieldCheck size={36} color="#cbd5e1" style={{ marginBottom: 12 }} />
                    <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>Sin auditorías ejecutadas aún</p>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e8ecf0" }}>
                          {[
                            { label: "Fecha y hora", align: "left" },
                            { label: "Ejecutado por", align: "left" },
                            { label: "Activo real", align: "right" },
                            { label: "Pasivo total", align: "right" },
                            { label: "Diferencia", align: "right" },
                            { label: "Saldos usuarios", align: "right" },
                            { label: "Retiros pend.", align: "right" },
                            { label: "Liability bets", align: "right" },
                            { label: "Estado", align: "center" },
                          ].map(({ label, align }) => (
                            <th key={label} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: align as any, whiteSpace: "nowrap" }}>
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {auditLog.map((a, i) => (
                          <tr key={a.id} style={{ borderBottom: "1px solid #f8fafc", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                            <td style={{ padding: "11px 14px", fontSize: 12, color: "#374151", whiteSpace: "nowrap" }}>
                              {new Date(a.run_at).toLocaleString("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </td>
                            <td style={{ padding: "11px 14px", fontSize: 12, color: "#64748b" }}>
                              {a.run_by || "—"}
                            </td>
                            <td style={{ padding: "11px 14px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "#059669", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                              ${(a.dinero_real || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: "11px 14px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "#7c3aed", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                              ${(a.pasivo_total || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: "11px 14px", textAlign: "right", fontSize: 12, fontWeight: 800, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: a.is_balanced ? "#059669" : "#be123c" }}>
                              {a.gap >= 0 ? "+" : ""}${(a.gap || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: "11px 14px", textAlign: "right", fontSize: 11, color: "#475569", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                              ${((a.detail?.sum_balances) || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: "11px 14px", textAlign: "right", fontSize: 11, color: "#475569", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                              ${((a.detail?.pending_withdrawals) || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: "11px 14px", textAlign: "right", fontSize: 11, color: "#475569", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                              ${((a.detail?.pending_bets_liability) || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: "11px 14px", textAlign: "center" }}>
                              {a.is_balanced ? (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, background: "#dcfce7", color: "#15803d", fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
                                  <CheckCircle size={10} /> CUADRADO
                                </span>
                              ) : (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, background: "#fee2e2", color: "#be123c", fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
                                  <AlertTriangle size={10} /> GAP
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ RETIROS ══ */}
          {tab === "withdrawals" && (() => {
            const pending  = withdrawals.filter((w) => w.status === "pending");
            const resolved = withdrawals.filter((w) => w.status !== "pending");
            const totalPending = pending.reduce((s: number, w: any) => s + (w.amount || 0), 0);

            const statusBadge = (s: string) => {
              if (s === "pending")  return { bg: "#fef3c7", color: "#92400e", label: "Pendiente" };
              if (s === "approved") return { bg: "#dcfce7", color: "#166534", label: "Pagado"    };
              return                       { bg: "#fee2e2", color: "#991b1b", label: "Rechazado" };
            };

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                {/* KPIs */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                  {[
                    { label: "Solicitudes pendientes", value: pending.length, color: "#d97706" },
                    { label: "Monto pendiente (MXN)",  value: `$${totalPending.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: "#d97706" },
                    { label: "Total procesados",        value: resolved.length, color: "#059669" },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: "#fff", border: "1px solid #e8ecf0", borderRadius: 14, padding: "20px 22px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 10px" }}>{label}</p>
                      <p style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1, margin: 0, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Solicitudes pendientes */}
                <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8ecf0", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                  <div style={{ padding: "14px 20px", borderBottom: "1px solid #f0f4f8" }}>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: 0 }}>Solicitudes pendientes</h3>
                    <p style={{ fontSize: 11, color: "#94a3b8", margin: "3px 0 0" }}>Requieren acción del administrador</p>
                  </div>

                  {pending.length === 0 ? (
                    <div style={{ padding: "40px 20px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                      No hay retiros pendientes
                    </div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e8ecf0" }}>
                          {["Usuario", "Monto", "CLABE / Banco", "Titular", "Fecha", "Acciones"].map((h) => (
                            <th key={h} style={{ padding: "10px 16px", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "left" }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pending.map((w: any, i: number) => {
                          const details = w.bank_details || {};
                          const busy    = actionLoading === w.id + "approve" || actionLoading === w.id + "reject";
                          return (
                            <tr key={w.id} style={{ borderBottom: "1px solid #f8fafc", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                              <td style={{ padding: "12px 16px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <User size={13} color="#64748b" />
                                  </div>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                                    {w.profiles?.username || "—"}
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 800, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
                                ${(w.amount || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
                              </td>
                              <td style={{ padding: "12px 16px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                  <Building2 size={11} color="#64748b" />
                                  <div>
                                    <p style={{ fontSize: 12, fontFamily: "monospace", color: "#0f172a", margin: 0, letterSpacing: "0.05em" }}>{details.clabe || "—"}</p>
                                    <p style={{ fontSize: 10, color: "#64748b", margin: 0 }}>{details.bank_name || "—"}</p>
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding: "12px 16px", fontSize: 12, color: "#374151" }}>
                                {details.holder_name || "—"}
                              </td>
                              <td style={{ padding: "12px 16px", fontSize: 11, color: "#64748b", whiteSpace: "nowrap" }}>
                                {new Date(w.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </td>
                              <td style={{ padding: "12px 16px" }}>
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button
                                    onClick={() => approveWithdrawal(w.id, w.amount, w.profiles?.username)}
                                    disabled={busy}
                                    style={{
                                      display: "flex", alignItems: "center", gap: 4,
                                      padding: "5px 10px", borderRadius: 6, border: "none", cursor: busy ? "not-allowed" : "pointer",
                                      background: "#dcfce7", color: "#166534", fontSize: 11, fontWeight: 600, opacity: busy ? 0.5 : 1,
                                    }}
                                  >
                                    <CheckCircle size={12} /> Marcar pagado
                                  </button>
                                  <button
                                    onClick={() => rejectWithdrawal(w.id, w.amount, w.profiles?.username)}
                                    disabled={busy}
                                    style={{
                                      display: "flex", alignItems: "center", gap: 4,
                                      padding: "5px 10px", borderRadius: 6, border: "none", cursor: busy ? "not-allowed" : "pointer",
                                      background: "#fee2e2", color: "#991b1b", fontSize: 11, fontWeight: 600, opacity: busy ? 0.5 : 1,
                                    }}
                                  >
                                    <XCircle size={12} /> Rechazar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Historial de retiros procesados */}
                {resolved.length > 0 && (
                  <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8ecf0", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                    <div style={{ padding: "14px 20px", borderBottom: "1px solid #f0f4f8" }}>
                      <h3 style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: 0 }}>Historial de retiros</h3>
                      <p style={{ fontSize: 11, color: "#94a3b8", margin: "3px 0 0" }}>Solicitudes ya procesadas</p>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e8ecf0" }}>
                          {["Usuario", "Monto", "Estado", "Banco", "Fecha"].map((h) => (
                            <th key={h} style={{ padding: "10px 16px", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "left" }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {resolved.map((w: any, i: number) => {
                          const details = w.bank_details || {};
                          const badge   = statusBadge(w.status);
                          return (
                            <tr key={w.id} style={{ borderBottom: "1px solid #f8fafc", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                              <td style={{ padding: "11px 16px", fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                                {w.profiles?.username || "—"}
                              </td>
                              <td style={{ padding: "11px 16px", fontSize: 13, fontWeight: 700, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
                                ${(w.amount || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
                              </td>
                              <td style={{ padding: "11px 16px" }}>
                                <span style={{ fontSize: 10, background: badge.bg, color: badge.color, fontWeight: 700, padding: "3px 8px", borderRadius: 20 }}>
                                  {badge.label}
                                </span>
                              </td>
                              <td style={{ padding: "11px 16px", fontSize: 11, color: "#64748b" }}>
                                {details.bank_name || "—"} · <span style={{ fontFamily: "monospace" }}>{(details.clabe || "").slice(-4) ? `****${(details.clabe || "").slice(-4)}` : "—"}</span>
                              </td>
                              <td style={{ padding: "11px 16px", fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap" }}>
                                {new Date(w.updated_at || w.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            );
          })()}

          {/* ══ HISTORIAL ══ */}
          {tab === "historial" && (() => {
            const closed  = markets.filter((m) => m.status === "closed");
            const open    = markets.filter((m) => m.status === "open");
            const resolved = closed.filter((m) => m.result || m.winning_option_id || m.scalar_result != null);

            const totalPool      = markets.reduce((s: number, m: any) => s + (m.total_pool || 0), 0);
            const totalPaid      = bets.filter((b: any) => b.status === "won").reduce((s: number, b: any) => s + (b.payout_amount || 0), 0);
            const totalFees      = bets.filter((b: any) => b.status === "won").reduce((s: number, b: any) => s + ((b.payout_amount || 0) * 0.03 / 0.97), 0);
            const avgBet         = bets.length > 0 ? bets.reduce((s: number, b: any) => s + (b.amount || 0), 0) / bets.length : 0;
            const avgBettors     = markets.length > 0 ? markets.reduce((s: number, m: any) => s + (m.bettor_count || 0), 0) / markets.length : 0;

            const summaryCards = [
              { label: "Total mercados",    value: String(markets.length),          sub: `${open.length} activos · ${closed.length} cerrados`, color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
              { label: "Mercados resueltos", value: String(resolved.length),        sub: `${closed.length - resolved.length} sin resolver`,    color: "#059669", bg: "#ecfdf5", border: "#6ee7b7" },
              { label: "Pozo histórico",    value: fmtExact(totalPool),             sub: "MXN apostados en total",                             color: "#d97706", bg: "#fffbeb", border: "#fcd34d" },
              { label: "Total pagado",      value: fmtExact(totalPaid),             sub: "a ganadores",                                        color: "#7c3aed", bg: "#fdf4ff", border: "#e9d5ff" },
              { label: "Apuesta promedio",  value: fmtExact(avgBet),               sub: `${avgBettors.toFixed(1)} apostadores/mercado`,        color: "#0369a1", bg: "#f0f9ff", border: "#7dd3fc" },
            ];

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                {/* Summary cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
                  {summaryCards.map((c) => (
                    <div key={c.label} style={{ background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 12, padding: "18px 20px" }}>
                      <p style={{ fontSize: 22, fontWeight: 800, color: c.color, margin: 0, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{c.value}</p>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", margin: "8px 0 2px" }}>{c.label}</p>
                      <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>{c.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Tabla */}
                {(() => {
                  const filtered = markets
                    .filter((m: any) => {
                      if (histFilter === "open")     return m.status === "open";
                      if (histFilter === "closed")   return m.status === "closed";
                      if (histFilter === "resolved") return m.status === "closed" && (m.result || m.winning_option_id || m.scalar_result != null);
                      return true;
                    })
                    .filter((m: any) => !histSearch || m.title.toLowerCase().includes(histSearch.toLowerCase()) || m.subject_name.toLowerCase().includes(histSearch.toLowerCase()))
                    .sort((a: any, b: any) => {
                      if (histSort === "pool")    return b.total_pool - a.total_pool;
                      if (histSort === "bettors") return b.bettor_count - a.bettor_count;
                      return new Date(b.created_at || b.closes_at).getTime() - new Date(a.created_at || a.closes_at).getTime();
                    });

                  return (
                    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8ecf0", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>

                      {/* Header tabla */}
                      <div style={{ padding: "16px 20px", borderBottom: "1px solid #f0f4f8", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div>
                          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: 0 }}>Todos los mercados</h3>
                          <p style={{ fontSize: 11, color: "#94a3b8", margin: "3px 0 0" }}>{filtered.length} de {markets.length} mercados</p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {/* Búsqueda */}
                          <input
                            value={histSearch}
                            onChange={(e) => setHistSearch(e.target.value)}
                            placeholder="Buscar mercado..."
                            style={{ border: "1.5px solid #e8ecf0", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#0f172a", background: "#f8fafc", outline: "none", fontFamily: "inherit", width: 200 }}
                          />
                          {/* Filtro status */}
                          {(["all", "open", "closed", "resolved"] as const).map((f) => (
                            <button
                              key={f}
                              onClick={() => setHistFilter(f)}
                              style={{
                                padding: "5px 12px", borderRadius: 6, border: "1.5px solid",
                                borderColor: histFilter === f ? "#2563eb" : "#e8ecf0",
                                background: histFilter === f ? "#eff6ff" : "#fff",
                                color: histFilter === f ? "#1d4ed8" : "#64748b",
                                fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                              }}
                            >
                              {{ all: "Todos", open: "Activos", closed: "Cerrados", resolved: "Resueltos" }[f]}
                            </button>
                          ))}
                          {/* Ordenar */}
                          <select
                            value={histSort}
                            onChange={(e) => setHistSort(e.target.value as any)}
                            style={{ border: "1.5px solid #e8ecf0", borderRadius: 8, padding: "6px 10px", fontSize: 11, color: "#475569", background: "#f8fafc", outline: "none", fontFamily: "inherit", cursor: "pointer" }}
                          >
                            <option value="date">Más reciente</option>
                            <option value="pool">Mayor pozo</option>
                            <option value="bettors">Más apostadores</option>
                          </select>
                        </div>
                      </div>

                      {/* Tabla */}
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e8ecf0" }}>
                              {["Mercado", "Categoría", "Tipo", "Estado", "Resultado", "Pozo MXN", "Apostadores", "Sí %", "No %", "Cuota Sí", "Cuota No", "Cierre"].map((h) => (
                                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.length === 0 && (
                              <tr>
                                <td colSpan={12} style={{ textAlign: "center", padding: "48px 0", color: "#cbd5e1", fontSize: 13 }}>Sin resultados</td>
                              </tr>
                            )}
                            {filtered.map((m: any, idx: number) => {
                              const isOpen   = m.status === "open";
                              const hasResult = m.result || m.winning_option_id || m.scalar_result != null;
                              const resultLabel = m.scalar_result != null
                                ? `${m.scalar_result} ${m.scalar_unit ?? ""}`
                                : m.result === "yes" ? "SÍ" : m.result === "no" ? "NO" : "—";
                              const resultColor = m.result === "yes" ? "#059669" : m.result === "no" ? "#e11d48" : m.scalar_result != null ? "#2563eb" : "#94a3b8";

                              const marketBets = bets.filter((b: any) => b.market_id === m.id);
                              const wonBets    = marketBets.filter((b: any) => b.status === "won");
                              const totalPaidMarket = wonBets.reduce((s: number, b: any) => s + (b.payout_amount || 0), 0);
                              const feeMarket  = totalPaidMarket > 0 ? totalPaidMarket * 0.03 / 0.97 : 0;

                              return (
                                <tr
                                  key={m.id}
                                  style={{
                                    borderBottom: "1px solid #f0f4f8",
                                    background: idx % 2 === 0 ? "#fff" : "#fafafa",
                                    transition: "background 0.15s",
                                  }}
                                  onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#f0f9ff"; }}
                                  onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = idx % 2 === 0 ? "#fff" : "#fafafa"; }}
                                >
                                  {/* Mercado */}
                                  <td style={{ padding: "12px 14px", maxWidth: 260 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                      <div style={{ width: 32, height: 32, borderRadius: 8, background: "#0f172a", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9, fontWeight: 700, overflow: "hidden" }}>
                                        {m.subject_photo_url
                                          ? <img src={m.subject_photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                          : initials(m.subject_name)}
                                      </div>
                                      <div style={{ minWidth: 0 }}>
                                        <p style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{m.title}</p>
                                        <p style={{ fontSize: 10, color: "#94a3b8", margin: "2px 0 0" }}>{m.subject_name}</p>
                                      </div>
                                    </div>
                                  </td>
                                  {/* Categoría */}
                                  <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                                    <span style={{ background: "#f1f5f9", padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600, color: "#475569" }}>{m.category}</span>
                                  </td>
                                  {/* Tipo */}
                                  <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                                    <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
                                      {{ binary: "Binario", multiple: "Múltiple", scalar: "Scalar" }[m.market_type as string] ?? m.market_type}
                                    </span>
                                  </td>
                                  {/* Estado */}
                                  <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                                    <span style={{
                                      display: "inline-flex", alignItems: "center", gap: 4,
                                      padding: "3px 9px", borderRadius: 20, fontSize: 10, fontWeight: 800,
                                      background: isOpen ? "#dcfce7" : "#f1f5f9",
                                      color: isOpen ? "#15803d" : "#475569",
                                      border: `1px solid ${isOpen ? "#86efac" : "#e8ecf0"}`,
                                    }}>
                                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: isOpen ? "#22c55e" : "#94a3b8", flexShrink: 0 }} />
                                      {isOpen ? "Activo" : "Cerrado"}
                                    </span>
                                  </td>
                                  {/* Resultado */}
                                  <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                                    <span style={{ fontSize: 12, fontWeight: 800, color: resultColor }}>
                                      {hasResult ? resultLabel : <span style={{ color: "#cbd5e1" }}>—</span>}
                                    </span>
                                  </td>
                                  {/* Pozo */}
                                  <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                                    <p style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", margin: 0 }}>{fmtExact(m.total_pool || 0)}</p>
                                    {feeMarket > 0 && <p style={{ fontSize: 10, color: "#10b981", margin: "1px 0 0", fontWeight: 600 }}>Fee: {fmtExact(feeMarket)}</p>}
                                  </td>
                                  {/* Apostadores */}
                                  <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{(m.bettor_count || 0).toLocaleString("es-MX")}</span>
                                  </td>
                                  {/* Sí % */}
                                  <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>{m.yes_percent ?? 50}%</span>
                                  </td>
                                  {/* No % */}
                                  <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: "#e11d48" }}>{100 - (m.yes_percent ?? 50)}%</span>
                                  </td>
                                  {/* Cuota Sí */}
                                  <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>{(m.yes_odds ?? 2).toFixed(2)}x</span>
                                  </td>
                                  {/* Cuota No */}
                                  <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: "#e11d48" }}>{(m.no_odds ?? 2).toFixed(2)}x</span>
                                  </td>
                                  {/* Cierre */}
                                  <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>
                                      {m.closes_at ? new Date(m.closes_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          {filtered.length > 0 && (
                            <tfoot>
                              <tr style={{ background: "#f8fafc", borderTop: "2px solid #e8ecf0" }}>
                                <td colSpan={5} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#64748b" }}>
                                  TOTALES · {filtered.length} mercados
                                </td>
                                <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 800, color: "#0f172a", whiteSpace: "nowrap" }}>
                                  {fmtExact(filtered.reduce((s: number, m: any) => s + (m.total_pool || 0), 0))}
                                </td>
                                <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
                                  {filtered.reduce((s: number, m: any) => s + (m.bettor_count || 0), 0).toLocaleString("es-MX")}
                                </td>
                                <td colSpan={5} />
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    </div>
                  );
                })()}

              </div>
            );
          })()}

          {/* ══ BORRADORES IA ══ */}
          {tab === "borradores" && (() => {
            const drafts = markets.filter((m: any) => m.status === "draft");

            const catTheme: Record<string, { bg: string; color: string; border: string }> = {
              Entretenimiento: { bg: "#fdf4ff", color: "#7c3aed", border: "#e9d5ff" },
              Política:        { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },
              Deportes:        { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
              Economía:        { bg: "#ecfdf5", color: "#059669", border: "#a7f3d0" },
              Famosos:         { bg: "#fef9c3", color: "#a16207", border: "#fde68a" },
              Finanzas:        { bg: "#ecfdf5", color: "#059669", border: "#a7f3d0" },
              Cultura:         { bg: "#fdf4ff", color: "#9333ea", border: "#e9d5ff" },
              Tech:            { bg: "#f0f9ff", color: "#0284c7", border: "#bae6fd" },
            };

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

                {/* Header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>Borradores generados por IA</h2>
                      {drafts.length > 0 && (
                        <span style={{
                          background: "linear-gradient(135deg, #ede9fe, #dbeafe)",
                          color: "#4f46e5", border: "1.5px solid #c4b5fd",
                          borderRadius: 20, padding: "2px 12px", fontSize: 12, fontWeight: 700,
                        }}>
                          {drafts.length} pendientes
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
                      Revisa cada predicción antes de publicarla. Los borradores no son visibles al público.
                    </p>
                  </div>
                  <button
                    onClick={generateWithAI}
                    disabled={generatingMarkets}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "11px 22px", borderRadius: 10,
                      background: generatingMarkets
                        ? "#f1f5f9"
                        : "linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)",
                      color: generatingMarkets ? "#94a3b8" : "#fff",
                      border: "none", fontSize: 13, fontWeight: 700,
                      cursor: generatingMarkets ? "not-allowed" : "pointer",
                      boxShadow: generatingMarkets ? "none" : "0 4px 14px rgba(124,58,237,0.35)",
                      fontFamily: "inherit", whiteSpace: "nowrap",
                    }}
                  >
                    {generatingMarkets
                      ? <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: "50%", border: "2px solid #cbd5e1", borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} />
                      : <Sparkles size={15} />
                    }
                    {generatingMarkets ? "Generando con IA..." : "Generar 10 con IA"}
                  </button>
                </div>

                {/* Empty state */}
                {drafts.length === 0 && (
                  <div style={{
                    background: "#fff", border: "2px dashed #e8ecf0", borderRadius: 16,
                    padding: "64px 20px", textAlign: "center",
                  }}>
                    <div style={{
                      width: 60, height: 60, borderRadius: "50%",
                      background: "linear-gradient(135deg, #ede9fe, #dbeafe)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      margin: "0 auto 18px",
                    }}>
                      <Sparkles size={26} style={{ color: "#7c3aed" }} />
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: "0 0 8px" }}>
                      No hay borradores por revisar
                    </h3>
                    <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 24px", maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>
                      Haz clic en <strong style={{ color: "#7c3aed" }}>"Generar 10 con IA"</strong> para crear predicciones de morbo mexicano automáticamente. Costarán ~$0.002 USD por corrida.
                    </p>
                  </div>
                )}

                {/* Grid de borradores */}
                {drafts.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
                    {drafts.map((m: any) => {
                      const cat = catTheme[m.category] ?? { bg: "#f8fafc", color: "#64748b", border: "#e8ecf0" };
                      const yesP = m.yes_percent ?? 50;
                      const noP  = 100 - yesP;
                      const isPublishing = actionLoading === m.id + "publish";
                      const isDeleting   = actionLoading === m.id + "del";

                      return (
                        <div key={m.id} style={{
                          background: "#fff",
                          border: "1px solid #e8ecf0",
                          borderRadius: 14,
                          padding: "20px",
                          display: "flex",
                          flexDirection: "column",
                          gap: 14,
                          boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
                        }}>

                          {/* Badges top */}
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <span style={{
                                background: cat.bg, color: cat.color, border: `1.5px solid ${cat.border}`,
                                borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700,
                              }}>
                                {m.category}
                              </span>
                              <span style={{
                                background: "#f8fafc", color: "#475569",
                                border: "1px solid #e8ecf0",
                                borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600,
                              }}>
                                {m.subject_name}
                              </span>
                            </div>
                            <span style={{
                              background: "#fefce8", color: "#a16207",
                              border: "1px solid #fde68a",
                              borderRadius: 20, padding: "3px 10px", fontSize: 10, fontWeight: 700,
                              whiteSpace: "nowrap",
                            }}>
                              BORRADOR
                            </span>
                          </div>

                          {/* Title */}
                          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: 0, lineHeight: 1.45 }}>
                            {m.title}
                          </h3>

                          {/* Description */}
                          {m.description && (
                            <p style={{ fontSize: 12, color: "#64748b", margin: 0, lineHeight: 1.5 }}>
                              {m.description}
                            </p>
                          )}

                          {/* Probability bar */}
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 7 }}>
                              <span style={{ color: "#16a34a", fontWeight: 700 }}>
                                SÍ {yesP}% · {(m.yes_odds ?? 2).toFixed(2)}x
                              </span>
                              <span style={{ color: "#be123c", fontWeight: 700 }}>
                                {(m.no_odds ?? 2).toFixed(2)}x · {noP}% NO
                              </span>
                            </div>
                            <div style={{ display: "flex", height: 7, borderRadius: 5, overflow: "hidden" }}>
                              <div style={{ background: "#22c55e", width: `${yesP}%`, transition: "width 0.3s" }} />
                              <div style={{ background: "#f43f5e", width: `${noP}%`, transition: "width 0.3s" }} />
                            </div>
                          </div>

                          {/* Closes at */}
                          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#94a3b8" }}>
                            <Clock size={11} />
                            Cierra: {m.closes_at
                              ? new Date(m.closes_at).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
                              : "—"}
                          </div>

                          {/* Divider */}
                          <div style={{ height: 1, background: "#f1f5f9" }} />

                          {/* Actions */}
                          <div style={{ display: "flex", gap: 8 }}>
                            {/* Editar y publicar — carga el borrador en el formulario */}
                            <button
                              onClick={() => loadDraft(m)}
                              disabled={!!actionLoading}
                              style={{
                                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                                padding: "10px 14px", borderRadius: 8,
                                background: "#2563eb", color: "#fff",
                                border: "none", fontSize: 12, fontWeight: 700,
                                cursor: actionLoading ? "not-allowed" : "pointer",
                                fontFamily: "inherit",
                              }}
                            >
                              <Pencil size={13} />
                              Editar y publicar
                            </button>
                            <button
                              onClick={() => deleteDraft(m.id)}
                              disabled={!!actionLoading}
                              style={{
                                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                                padding: "10px 14px", borderRadius: 8,
                                background: "#fff", color: "#dc2626",
                                border: "1.5px solid #fecaca",
                                fontSize: 12, fontWeight: 700,
                                cursor: actionLoading ? "not-allowed" : "pointer",
                                fontFamily: "inherit",
                              }}
                            >
                              <Trash2 size={13} />
                              {isDeleting ? "..." : "Eliminar"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

        </div>
      </main>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
