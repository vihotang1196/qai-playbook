import { Outlet, useLocation } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

/**
 * Is this a throwaway tab spawned for Stripe checkout? Only the return page and
 * an embedded cancel ever carry `embed=1` (the server appends it to those two
 * URLs). Such a tab is used once and closed, so the site nav would only tempt
 * the customer to keep browsing HERE and lose track of the GHL iframe their
 * session actually lives in.
 *
 * Scoped by PATH as well as the flag, so a stray `embed=1` on any other route
 * can never strip that route's navigation.
 */
function isSpawnedCheckoutTab(pathname: string, search: string): boolean {
  const q = new URLSearchParams(search);
  if (q.get("embed") !== "1") return false;
  if (pathname.startsWith("/checkout/return")) return true;
  return pathname.startsWith("/events") && q.get("checkout") === "cancelled";
}

/**
 * App shell shared by every route inside it (homepage + Review Boost customer
 * app). The public scan / thank-you pages and the Admin Portal live OUTSIDE this
 * Layout and are unaffected by it.
 *
 * Renders ONE continuous VisionOS ambient background plus the shared Navbar and
 * Footer. The navbar is ALWAYS shown — including inside the GHL iframe (embed) —
 * per the owner's decision, so the full Playbook nav is available there too.
 *
 * Pages must NOT render their own background, Navbar or Footer.
 */
const Layout = () => {
  const { pathname, search } = useLocation();
  // Display-only: hides the chrome on spawned checkout tabs. No page logic is
  // touched — the return page's countdown, close(), 800ms fallback and broadcast
  // all behave identically either way.
  const bareTab = isSpawnedCheckoutTab(pathname, search);
  return (
    // Flex column + min-h-screen makes this a classic sticky footer: the content
    // region (flex-1) grows to fill the viewport at ANY window size, so the Footer
    // is always pushed to the very bottom with no whitespace below it. (100vh
    // adapts to the window, so full-screen and half/short windows both stick.)
    <div className="relative flex min-h-screen flex-col overflow-x-hidden">
      {/* Brutalist dot-grid paper background (rebrand batch 1) — one fixed
          full-viewport layer, white base + fine ink dots. Replaces the coral
          ambient glow (archived at tag `backup-coral-glass`). */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          backgroundColor: "#ffffff",
          backgroundImage: "radial-gradient(rgba(20,20,20,0.12) 1.6px, transparent 1.7px)",
          backgroundSize: "26px 26px",
        }}
      />

      {!bareTab && <Navbar />}
      {/* Content region — grows to fill so the Footer sticks to the bottom. Not a
          <main> (some pages render their own <main>, which mustn't nest). */}
      <div className="flex flex-1 flex-col">
        <Outlet />
      </div>
      {!bareTab && <Footer />}
    </div>
  );
};

export default Layout;
