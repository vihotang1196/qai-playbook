import { Outlet } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

/**
 * App shell shared by every route.
 *
 * Renders ONE continuous VisionOS ambient background — a fixed, full-viewport
 * layer pinned behind all content — plus the shared Navbar and Footer. Because
 * the background is fixed to the viewport (not per-page / per-section), it never
 * breaks, bands, or jumps when navigating between routes or scrolling.
 *
 * Pages must NOT render their own background, Navbar or Footer.
 */
const Layout = () => {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Continuous ambient light layer. Near-white base (#FCFDFF) with three
          soft corner glows — top-left pink, top-right lilac, bottom blue-lilac
          — each ≤0.3 opacity, ~100px blur, partly off-canvas so the centre of
          the screen always stays near-white. Never a solid colour block. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-[#FCFDFF]">
        <div className="absolute -top-[15vh] -left-[10vw] w-[60vw] h-[60vh] rounded-full bg-[#FCE4F1] opacity-30 blur-[100px]" />
        <div className="absolute -top-[12vh] -right-[12vw] w-[55vw] h-[55vh] rounded-full bg-[#EAE2FF] opacity-25 blur-[100px]" />
        <div className="absolute -bottom-[20vh] left-[20vw] w-[70vw] h-[55vh] rounded-full bg-[#DCE6FF] opacity-25 blur-[100px]" />
      </div>

      <Navbar />
      <Outlet />
      <Footer />
    </div>
  );
};

export default Layout;
