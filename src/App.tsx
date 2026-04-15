import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PromoterProvider } from "@/contexts/PromoterContext";
import { PromoterRouteGuard } from "@/components/layout/PromoterRouteGuard";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/layout/AuthGuard";
import Index from "./pages/Index";
import Plans from "./pages/Plans";
import Promotions from "./pages/Promotions";
import Calendar from "./pages/Calendar";
import Middleware from "./pages/Middleware";
import Marketing from "./pages/Marketing";
import Wallet from "./pages/Wallet";
import Settings from "./pages/Settings";
import MapPage from "./pages/MapPage";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";
import Unsubscribe from "./pages/Unsubscribe";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PromoterProvider>
            <Routes>
              {/* Public routes — no auth required */}
              <Route path="/unsubscribe" element={<Unsubscribe />} />
              <Route path="/login" element={<LoginPage />} />

              {/* All app routes — require valid session */}
              <Route
                path="/*"
                element={
                  <AuthGuard>
                    <AppLayout>
                      <Routes>
                        <Route path="/" element={<Navigate to="/home" replace />} />
                      <Route path="/home" element={<PromoterRouteGuard><Index /></PromoterRouteGuard>} />
                        <Route path="/plans" element={<Plans />} />
                        <Route path="/promotions" element={<Promotions />} />
                        <Route path="/calendar" element={<PromoterRouteGuard restricted><Calendar /></PromoterRouteGuard>} />
                        <Route path="/middleware" element={<Middleware />} />
                        <Route path="/marketing" element={<Marketing />} />
                        <Route path="/wallet" element={<PromoterRouteGuard restricted><Wallet /></PromoterRouteGuard>} />
                        <Route path="/settings" element={<PromoterRouteGuard restricted><Settings /></PromoterRouteGuard>} />
                        <Route path="/map" element={<MapPage />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </AppLayout>
                  </AuthGuard>
                }
              />
            </Routes>
          </PromoterProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
