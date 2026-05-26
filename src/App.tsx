import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AppLayout } from "@/components/layout/AppLayout";
import { PromoterProvider } from "@/contexts/PromoterContext";
import { PromoterRouteGuard } from "@/components/layout/PromoterRouteGuard";
import { SalesRepProvider } from "@/contexts/SalesRepContext";
import { SalesRepRouteGuard } from "@/components/layout/SalesRepRouteGuard";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { ScrollToTop } from "@/components/common/ScrollToTop";
import Index from "./pages/Index";
import Plans from "./pages/Plans";
import Promotions from "./pages/Promotions";
import Calendar from "./pages/Calendar";
import Middleware from "./pages/Middleware";
import Marketing from "./pages/Marketing";
import Wallet from "./pages/Wallet";
import Settings from "./pages/Settings";
import MapPage from "./pages/MapPage";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import Orders from "./pages/Orders";
import ECommerce from "./pages/ECommerce";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";
import Unsubscribe from "./pages/Unsubscribe";
import Agotados from "./pages/Agotados";
import Transfers from "./pages/Transfers";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey="ivanagro-theme"
    >
      <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <AuthProvider>
          <PromoterProvider>
            <SalesRepProvider>
              <Routes>
                {/* Public routes — no auth required */}
                <Route path="/unsubscribe" element={<Unsubscribe />} />
                <Route path="/e-commerce" element={<ECommerce />} />
                <Route path="/login" element={<LoginPage />} />

                {/* All app routes — require valid session */}
                <Route
                  path="/*"
                  element={
                    <AuthGuard>
                      <AppLayout>
                        <Routes>
                          <Route path="/" element={<Navigate to="/home" replace />} />
                          <Route path="/home" element={<SalesRepRouteGuard><PromoterRouteGuard><Index /></PromoterRouteGuard></SalesRepRouteGuard>} />
                          <Route path="/plans" element={<SalesRepRouteGuard><Plans /></SalesRepRouteGuard>} />
                          <Route path="/promotions" element={<SalesRepRouteGuard><Promotions /></SalesRepRouteGuard>} />
                          <Route path="/orders" element={<SalesRepRouteGuard><Orders /></SalesRepRouteGuard>} />
                          <Route path="/products" element={<SalesRepRouteGuard><Products /></SalesRepRouteGuard>} />
                          <Route path="/customers" element={<SalesRepRouteGuard><Customers /></SalesRepRouteGuard>} />
                          <Route path="/calendar" element={<SalesRepRouteGuard><PromoterRouteGuard restricted><Calendar /></PromoterRouteGuard></SalesRepRouteGuard>} />
                          <Route path="/middleware" element={<SalesRepRouteGuard><Middleware /></SalesRepRouteGuard>} />
                          <Route path="/marketing" element={<SalesRepRouteGuard><Marketing /></SalesRepRouteGuard>} />
                          <Route path="/wallet" element={<SalesRepRouteGuard><PromoterRouteGuard restricted><Wallet /></PromoterRouteGuard></SalesRepRouteGuard>} />
                          <Route path="/settings" element={<SalesRepRouteGuard><PromoterRouteGuard restricted><Settings /></PromoterRouteGuard></SalesRepRouteGuard>} />
                          <Route path="/map" element={<SalesRepRouteGuard><MapPage /></SalesRepRouteGuard>} />
                          <Route path="/sold-out" element={<Agotados />} />
                          <Route path="/transfers" element={<Transfers />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </AppLayout>
                    </AuthGuard>
                  }
                />
              </Routes>
            </SalesRepProvider>
          </PromoterProvider>
        </AuthProvider>
      </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
