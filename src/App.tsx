import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PromoterProvider } from "@/contexts/PromoterContext";
import { PromoterRouteGuard } from "@/components/layout/PromoterRouteGuard";
import Index from "./pages/Index";
import Plans from "./pages/Plans";
import Promotions from "./pages/Promotions";
import Calendar from "./pages/Calendar";
import Middleware from "./pages/Middleware";
import Marketing from "./pages/Marketing";
import Wallet from "./pages/Wallet";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Unsubscribe from "./pages/Unsubscribe";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <PromoterProvider>
          <Routes>
            {/* Public standalone pages (no AppLayout) */}
            <Route path="/unsubscribe" element={<Unsubscribe />} />

            {/* App pages wrapped in AppLayout */}
            <Route
              path="/*"
              element={
                <AppLayout>
                  <Routes>
                    <Route path="/" element={<PromoterRouteGuard><Index /></PromoterRouteGuard>} />
                    <Route path="/plans" element={<Plans />} />
                    <Route path="/promotions" element={<Promotions />} />
                    <Route path="/calendar" element={<PromoterRouteGuard restricted><Calendar /></PromoterRouteGuard>} />
                    <Route path="/middleware" element={<Middleware />} />
                    <Route path="/marketing" element={<Marketing />} />
                    <Route path="/wallet" element={<PromoterRouteGuard restricted><Wallet /></PromoterRouteGuard>} />
                    <Route path="/settings" element={<PromoterRouteGuard restricted><Settings /></PromoterRouteGuard>} />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </AppLayout>
              }
            />
          </Routes>
        </PromoterProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
