import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/i18n/LanguageContext";
import Layout from "@/components/Layout";
import Index from "./pages/Index.tsx";
import DFY from "./pages/DFY.tsx";
import Credits from "./pages/Credits.tsx";
import Upgrade from "./pages/Upgrade.tsx";
import Affiliate from "./pages/Affiliate.tsx";
import NotFound from "./pages/NotFound.tsx";
import ReviewBoostLanding from "./pages/review-boost/Landing";
import {
  Campaigns as RBCampaigns,
  Platforms as RBPlatforms,
  SubAccounts as RBSubAccounts,
  CampaignDetail as RBCampaignDetail,
  LocationCampaigns as RBLocationCampaigns,
  LocationCampaignCreate as RBLocationCampaignCreate,
  LocationDashboard as RBLocationDashboard,
  LocationSettings as RBLocationSettings,
  RBAuth,
  ScanPage as RBScanPage,
  ThankYouPage as RBThankYouPage,
} from "./pages/review-boost/pages";

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <LanguageProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            {/* Review Boost public customer flow — full-screen, mobile-first,
                intentionally OUTSIDE the shared Layout (no site navbar/footer). */}
            <Route path="/scan/:code" element={<RBScanPage />} />
            <Route path="/thank-you/:generationId" element={<RBThankYouPage />} />

            {/* All other routes share the Layout shell (continuous background + Navbar + Footer). */}
            <Route element={<Layout />}>
              <Route path="/" element={<Index />} />
              <Route path="/dfy" element={<DFY />} />
              <Route path="/credits" element={<Credits />} />
              <Route path="/upgrade" element={<Upgrade />} />
              <Route path="/affiliate" element={<Affiliate />} />

              {/* Review Boost admin (Phase 0 scaffold — stubs replaced per phase) */}
              <Route path="/review-boost" element={<ReviewBoostLanding />} />
              <Route path="/review-boost/auth" element={<RBAuth />} />
              <Route path="/review-boost/campaigns" element={<RBCampaigns />} />
              <Route path="/review-boost/campaigns/:id" element={<RBCampaignDetail />} />
              <Route path="/review-boost/platforms" element={<RBPlatforms />} />
              <Route path="/review-boost/sub-accounts" element={<RBSubAccounts />} />
              <Route path="/review-boost/location/:locationId/campaigns" element={<RBLocationCampaigns />} />
              <Route path="/review-boost/location/:locationId/campaigns/new" element={<RBLocationCampaignCreate />} />
              <Route path="/review-boost/location/:locationId/campaigns/:id/edit" element={<RBLocationCampaignCreate />} />
              <Route path="/review-boost/location/:locationId/campaigns/:id" element={<RBCampaignDetail />} />
              <Route path="/review-boost/location/:locationId/dashboard" element={<RBLocationDashboard />} />
              <Route path="/review-boost/location/:locationId/settings" element={<RBLocationSettings />} />

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
