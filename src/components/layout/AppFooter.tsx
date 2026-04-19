import { Link, useNavigate } from "react-router-dom";
import { Mail, Instagram, Twitter } from "lucide-react";

const CATEGORIES = [
  { label: "Política",        sub: "Pronósticos y predicciones" },
  { label: "Deportes",        sub: "Probabilidades y predicciones" },
  { label: "Entretenimiento", sub: "Tendencias y predicciones" },
  { label: "Finanzas",        sub: "Pronósticos y predicciones" },
  { label: "Tech",            sub: "Tendencias y predicciones" },
  { label: "Música",          sub: "Predicciones" },
  { label: "Negocios",        sub: "Predicciones" },
  { label: "Elecciones",      sub: "Pronósticos y predicciones" },
  { label: "Redes",           sub: "Tendencias y predicciones" },
  { label: "Cultura",         sub: "Tendencias y predicciones" },
];

const COL_APOYO = [
  { label: "Centro de ayuda", to: "/help" },
  { label: "¿Cómo funciona?", to: "/faq" },
  { label: "Leaderboard",     to: "/leaderboard" },
  { label: "Contáctanos",     href: "mailto:contacto@lucebase.mx" },
];

const COL_PLATAFORMA = [
  { label: "Mis predicciones", to: "/my-bets" },
  { label: "Leaderboard",      to: "/leaderboard" },
  { label: "Tabla de clasificación", to: "/leaderboard" },
  { label: "FAQ",              to: "/faq" },
];

export function AppFooter() {
  const navigate = useNavigate();

  const goCategory = (cat: string) =>
    navigate(`/?cat=${encodeURIComponent(cat)}`);

  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0d1117] mt-16">

      {/* ── Cuerpo principal ── */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-10">

          {/* ── Columna: Logo + categorías ── */}
          <div>
            {/* Logo */}
            <Link to="/" className="inline-flex items-center gap-2 mb-2">
              <div className="w-7 h-7 bg-gray-900 dark:bg-white rounded-lg flex items-center justify-center shrink-0">
                <span className="text-white dark:text-gray-900 text-xs font-black">C</span>
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                Lucebase
              </span>
            </Link>
            <p className="text-[13px] text-gray-400 dark:text-gray-500 mb-6">
              El mercado de predicciones en español.
            </p>

            {/* Título de sección */}
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Mercados por categoría
            </p>

            {/* Grid de categorías */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-3">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.label}
                  onClick={() => goCategory(cat.label)}
                  className="text-left group"
                >
                  <p className="text-[13.5px] font-semibold text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white transition-colors leading-none">
                    {cat.label}
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 leading-none">
                    {cat.sub}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* ── Columna: Apoyo ── */}
          <div className="min-w-[160px]">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Apoyo
            </p>
            <ul className="space-y-3">
              {COL_APOYO.map((item) =>
                item.to ? (
                  <li key={item.label}>
                    <Link
                      to={item.to}
                      className="text-[13.5px] font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      {item.label}
                    </Link>
                  </li>
                ) : (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className="text-[13.5px] font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      {item.label}
                    </a>
                  </li>
                )
              )}
            </ul>
          </div>

          {/* ── Columna: Lucebase ── */}
          <div className="min-w-[160px]">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Lucebase
            </p>
            <ul className="space-y-3">
              {COL_PLATAFORMA.map((item) => (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    className="text-[13.5px] font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ── Barra inferior ── */}
      <div className="border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">

          {/* Íconos sociales */}
          <div className="flex items-center gap-3">
            <a
              href="mailto:contacto@lucebase.mx"
              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              title="Email"
            >
              <Mail size={16} />
            </a>
            <a
              href="#"
              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              title="X / Twitter"
            >
              <Twitter size={16} />
            </a>
            <a
              href="#"
              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              title="Instagram"
            >
              <Instagram size={16} />
            </a>
          </div>

          {/* Copyright + links legales */}
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11.5px] text-gray-400 dark:text-gray-500">
            <span>Lucebase © {new Date().getFullYear()}</span>
            <span className="hidden sm:inline text-gray-200 dark:text-gray-700">·</span>
            <Link to="/privacy" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              Privacidad
            </Link>
            <span className="text-gray-200 dark:text-gray-700">·</span>
            <Link to="/terms" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              Condiciones de uso
            </Link>
            <span className="text-gray-200 dark:text-gray-700">·</span>
            <Link to="/help" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              Centro de ayuda
            </Link>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 pb-5">
          <p className="text-[10.5px] text-gray-300 dark:text-gray-600 leading-relaxed">
            Lucebase es una plataforma de mercados de predicción con fines de entretenimiento. Los resultados dependen de eventos reales verificables. El trading implica un riesgo de pérdida. Participa de forma responsable.
          </p>
        </div>
      </div>
    </footer>
  );
}
