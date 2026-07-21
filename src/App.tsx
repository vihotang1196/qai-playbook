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
import ReviewBoostAdminShell from "./components/review-boost/AdminShell";
import ReviewBoostLanding from "./pages/review-boost/Landing";
import LocationPlatforms from "./pages/review-boost/LocationPlatforms";
import RBLocationCampaigns from "./pages/review-boost/LocationCampaigns";
import RBLocationCampaignCreate from "./pages/review-boost/LocationCampaignCreate";
import RBCampaignDetail from "./pages/review-boost/CampaignDetail";
import RBScanPage from "./pages/review-boost/ScanPage";
import RBThankYouPage from "./pages/review-boost/ThankYouPage";
import RBLocationDashboard from "./pages/review-boost/LocationDashboard";
import { LocationSettings as RBLocationSettings } from "./pages/review-boost/pages";
import AdminLayout from "./components/admin/AdminLayout";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminHome from "./pages/admin/AdminHome";
import AdminSubAccounts from "./pages/admin/AdminSubAccounts";
import AdminStats from "./pages/admin/AdminStats";
import AdminAudit from "./pages/admin/AdminAudit";
import HelpdeskAdminShell from "./components/helpdesk/HelpdeskAdminShell";
import HelpdeskOverview from "./pages/admin/helpdesk/Overview";
import HelpdeskKnowledge from "./pages/admin/helpdesk/Knowledge";
import HelpdeskArticleView from "./pages/admin/helpdesk/ArticleView";
import HelpdeskAiTest from "./pages/admin/helpdesk/AiTest";
import HelpdeskSettings from "./pages/admin/helpdesk/Settings";
import HelpdeskConversations from "./pages/admin/helpdesk/Conversations";
import HelpdeskAnalytics from "./pages/admin/helpdesk/Analytics";
import { HdUpdates } from "./pages/admin/helpdesk/sections";
import HelpWidget from "./pages/help/HelpWidget";

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

            {/* Admin Portal — platform-wide, real-login-guarded, OUTSIDE the
                customer Layout (its own dark chrome; zero customer capability).
                AdminLayout guards; every admin edge-fn action re-checks server-side. */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminHome />} />
              <Route path="sub-accounts" element={<AdminSubAccounts />} />
              <Route path="stats" element={<AdminStats />} />
              <Route path="audit" element={<AdminAudit />} />

              {/* Helpdesk admin — the shared help center is managed only by
                  signed-in platform admins, so it lives INSIDE the portal
                  (reusing the one login + guard) rather than in a customer route. */}
              <Route path="helpdesk" element={<HelpdeskAdminShell />}>
                <Route index element={<HelpdeskOverview />} />
                <Route path="knowledge" element={<HelpdeskKnowledge />} />
                <Route path="knowledge/:articleId" element={<HelpdeskArticleView />} />
                <Route path="chat" element={<HelpdeskAiTest />} />
                <Route path="conversations" element={<HelpdeskConversations />} />
                <Route path="analytics" element={<HelpdeskAnalytics />} />
                <Route path="updates" element={<HdUpdates />} />
                <Route path="settings" element={<HelpdeskSettings />} />
              </Route>
            </Route>

            {/* All other routes share the Layout shell (continuous background + Navbar + Footer). */}
            <Route element={<Layout />}>
              <Route path="/" element={<Index />} />
              <Route path="/dfy" element={<DFY />} />
              <Route path="/credits" element={<Credits />} />
              <Route path="/upgrade" element={<Upgrade />} />
              <Route path="/affiliate" element={<Affiliate />} />

              {/* Helpdesk — customer help center. INSIDE Layout so it wears the
                  Playbook navbar/footer (feels part of Playbook, like the RB
                  customer app). Still GHL-only: identity = URL location_id
                  (trust-the-URL); no location_id → a "请从 GHL 打开" block. */}
              <Route path="/help" element={<HelpWidget />} />

              {/* Review Boost — CUSTOMER (sub-account) app only. Identity = URL
                  location_id. Agency god-view (all sub-accounts / cross-client
                  campaigns+platforms / access toggles) is intentionally NOT routed
                  here — it belongs in the future authenticated Admin Portal. */}
              <Route element={<ReviewBoostAdminShell />}>
                <Route path="/review-boost" element={<ReviewBoostLanding />} />
                <Route path="/review-boost/location/:locationId" element={<RBLocationDashboard />} />
                <Route path="/review-boost/location/:locationId/dashboard" element={<RBLocationDashboard />} />
                <Route path="/review-boost/location/:locationId/campaigns" element={<RBLocationCampaigns />} />
                <Route path="/review-boost/location/:locationId/campaigns/new" element={<RBLocationCampaignCreate />} />
                <Route path="/review-boost/location/:locationId/campaigns/:id/edit" element={<RBLocationCampaignCreate />} />
                <Route path="/review-boost/location/:locationId/campaigns/:id" element={<RBCampaignDetail />} />
                <Route path="/review-boost/location/:locationId/platforms" element={<LocationPlatforms />} />
                <Route path="/review-boost/location/:locationId/settings" element={<RBLocationSettings />} />
              </Route>

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
