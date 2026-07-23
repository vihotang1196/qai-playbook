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
import OfflineEventAdminShell from "./components/offline-event/OfflineEventAdminShell";
import OEOverview from "./pages/admin/offline-event/Overview";
import OECheckIn from "./pages/admin/offline-event/CheckIn";
import OEBookings from "./pages/admin/offline-event/Bookings";
import OEEventDates from "./pages/admin/offline-event/EventDates";
import OESettings from "./pages/admin/offline-event/Settings";
import OEFloorPlans from "./pages/admin/offline-event/FloorPlans";
import EventsPage from "./pages/events/EventsPage";
import CheckoutReturn from "./pages/checkout/Return";
import { rememberLocationId } from "@/lib/ghl";

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};

/** Stash the GHL location_id on EVERY route so tools reached via the shared
 *  navbar (which drops the query string) still recover identity. Mirrors
 *  feat/helpdesk — shared, tool-neutral. */
const LocationIdKeeper = () => {
  const { pathname, search } = useLocation();
  useEffect(() => { rememberLocationId(search, pathname); }, [pathname, search]);
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
          <LocationIdKeeper />
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
              {/* Offline Event admin — nested tool (its own sub-tab shell). */}
              <Route path="offline-event" element={<OfflineEventAdminShell />}>
                <Route index element={<OEOverview />} />
                <Route path="bookings" element={<OEBookings />} />
                <Route path="event-dates" element={<OEEventDates />} />
                <Route path="floor-plans" element={<OEFloorPlans />} />
                <Route path="check-in" element={<OECheckIn />} />
                <Route path="settings" element={<OESettings />} />
              </Route>
            </Route>

            {/* All other routes share the Layout shell (continuous background + Navbar + Footer). */}
            <Route element={<Layout />}>
              <Route path="/" element={<Index />} />
              <Route path="/dfy" element={<DFY />} />
              <Route path="/credits" element={<Credits />} />
              <Route path="/upgrade" element={<Upgrade />} />
              <Route path="/affiliate" element={<Affiliate />} />

              {/* Offline Event — CUSTOMER booking page. Identity = URL location_id
                  (trust-the-URL). Entered via a GHL custom menu link. */}
              <Route path="/events" element={<EventsPage />} />
              {/* Stripe hosted-Checkout return landing. Polls the webhook-confirmed
                  booking, then shows its QR e-ticket. */}
              <Route path="/checkout/return" element={<CheckoutReturn />} />

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
