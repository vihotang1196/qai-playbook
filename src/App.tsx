import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
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
import HelpdeskAdminShell from "./components/helpdesk/HelpdeskAdminShell";
import HelpdeskOverview from "./pages/admin/helpdesk/Overview";
import HelpdeskKnowledge from "./pages/admin/helpdesk/Knowledge";
import HelpdeskArticleView from "./pages/admin/helpdesk/ArticleView";
import HelpdeskAiTest from "./pages/admin/helpdesk/AiTest";
import HelpdeskSettings from "./pages/admin/helpdesk/Settings";
import HelpdeskConversations from "./pages/admin/helpdesk/Conversations";
import HelpdeskAnalytics from "./pages/admin/helpdesk/Analytics";
import HelpdeskUpdates from "./pages/admin/helpdesk/Updates";
import HelpWidget from "./pages/help/HelpWidget";
import GuidePage from "./pages/guides/GuidePage";
import { rememberLocationId, rememberStaff, resolveLocationId, getDefaultPage } from "@/lib/ghl";

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};

/** Stash the GHL location_id on EVERY route so tools reached via the shared
 *  navbar (which drops the query string) still recover identity. Shared,
 *  tool-neutral (Offline Event, Helpdesk, Review Boost all rely on it). */
const LocationIdKeeper = () => {
  const { pathname, search } = useLocation();
  useEffect(() => {
    rememberLocationId(search, pathname);
    rememberStaff(search); // Need 2: keep the GHL staff (staff_email/name) too
  }, [pathname, search]);
  return null;
};

// Need 1 — per-sub-account default landing page. The agency-wide fallback used
// when a sub-account never set one. Owner's chosen fallback = Helpdesk; /help is
// now routed (Helpdesk merged in), so a sub-account that never set a default
// lands on the Help Center.
const DEFAULT_FALLBACK_PATH = "/help";

// Module-level guard: React StrictMode double-mounts the effect, so this stops a
// double-fire. It resets on a full page reload (so REOPENING Playbook re-applies
// the default), and the effect runs only ONCE on mount (never on in-app
// navigation), so it can never hijack a manual return to "/".
let entryRedirectHandled = false;

/**
 * On Playbook ENTRY, send a sub-account to its chosen default page. Three safety
 * rails (owner-required): (1) only acts at the ROOT path "/", never on a direct
 * tool page like /events or /help; (2) only when a GHL location_id is present
 * (public visitors untouched); (3) no loop — runs once, and never navigates to
 * the page you're already on. Falls back to DEFAULT_FALLBACK_PATH when unset.
 */
const DefaultPageRedirect = () => {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  useEffect(() => {
    if (entryRedirectHandled) return;
    if (pathname !== "/") return; // Rail 1/2: only the root entry — don't hijack a direct tool page
    const locId = resolveLocationId(pathname, search);
    if (!locId) return; // Rail 3: no location_id → leave public visitors alone
    entryRedirectHandled = true;
    getDefaultPage(locId)
      .then((saved) => {
        const target = saved || DEFAULT_FALLBACK_PATH;
        if (!target || target === "/" || target === pathname) return; // Rail 4: never self-redirect / loop
        const sep = target.includes("?") ? "&" : "?";
        navigate(`${target}${sep}location_id=${encodeURIComponent(locId)}`, { replace: true });
      })
      .catch(() => {
        /* fail-safe: stay on the homepage */
      });
    // run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
          <DefaultPageRedirect />
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
                <Route path="updates" element={<HelpdeskUpdates />} />
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

              {/* Offline Event — CUSTOMER booking page. Identity = URL location_id
                  (trust-the-URL). Entered via a GHL custom menu link. */}
              <Route path="/events" element={<EventsPage />} />
              {/* Stripe hosted-Checkout return landing. Polls the webhook-confirmed
                  booking, then shows its QR e-ticket. */}
              <Route path="/checkout/return" element={<CheckoutReturn />} />

              {/* Helpdesk — customer help center. INSIDE Layout so it wears the
                  Playbook navbar/footer. GHL-only: identity = URL location_id
                  (trust-the-URL); no location_id → a "请从 GHL 打开" block. */}
              <Route path="/help" element={<HelpWidget />} />

              {/* Guides — full-page help guides (from the navbar 指南 dropdown).
                  Public (no gate). */}
              <Route path="/guides/:slug" element={<GuidePage />} />

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
