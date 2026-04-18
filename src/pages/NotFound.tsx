import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Home, TrendingUp } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">

        {/* Logo */}
        <div className="w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="text-white text-lg font-black">Q</span>
        </div>

        <h1 className="text-6xl font-black text-gray-900 tabular-nums">404</h1>
        <p className="text-lg font-semibold text-gray-700 mt-2">Página no encontrada</p>
        <p className="text-sm text-gray-400 mt-1">
          La ruta <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">{location.pathname}</code> no existe.
        </p>

        <div className="flex items-center justify-center gap-3 mt-8">
          <Link
            to="/"
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors"
          >
            <Home size={15} />
            Inicio
          </Link>
          <Link
            to="/my-bets"
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
          >
            <TrendingUp size={15} />
            Mis predicciones
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
