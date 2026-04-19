import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";

const HomePage        = lazy(() => import("@/pages/HomePage"));
const MarketPage      = lazy(() => import("@/pages/MarketPage"));
const MyBetsPage      = lazy(() => import("@/pages/MyBetsPage"));
const ProfilePage     = lazy(() => import("@/pages/ProfilePage"));
const LeaderboardPage = lazy(() => import("@/pages/LeaderboardPage"));
const FAQPage         = lazy(() => import("@/pages/FAQPage"));
const HelpPage        = lazy(() => import("@/pages/HelpPage"));
const TermsPage          = lazy(() => import("@/pages/TermsPage"));
const PrivacyPage        = lazy(() => import("@/pages/PrivacyPage"));
const ResetPasswordPage  = lazy(() => import("@/pages/ResetPasswordPage"));
const PublicProfilePage  = lazy(() => import("@/pages/PublicProfilePage"));
const NotFound           = lazy(() => import("@/pages/NotFound"));
const AdminPage       = lazy(() => import("@/pages/AdminPage"));
const StatsPage       = lazy(() => import("@/pages/StatsPage"));
const NoticiasPage    = lazy(() => import("@/pages/NoticiasPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,   // 2 min — evita re-fetches innecesarios
      gcTime:    1000 * 60 * 10,  // 10 min en caché
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
    </div>
  );
}

const App = () => (
  <AuthProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/market/:id" element={<MarketPage />} />
                <Route path="/my-bets" element={<MyBetsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
                <Route path="/faq" element={<FAQPage />} />
                <Route path="/help" element={<HelpPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/user/:username" element={<PublicProfilePage />} />
                <Route path="/stats"     element={<StatsPage />} />
                <Route path="/noticias" element={<NoticiasPage />} />
                <Route path="*" element={<NotFound />} />
              </Route>
              <Route path="/admin" element={<AdminPage />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </AuthProvider>
);

export default App;
