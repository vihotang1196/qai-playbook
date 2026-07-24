import { Outlet } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

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
  return (
    // Flex column + min-h-screen makes this a classic sticky footer: the content
    // region (flex-1) grows to fill the viewport at ANY window size, so the Footer
    // is always pushed to the very bottom with no whitespace below it. (100vh
    // adapts to the window, so full-screen and half/short windows both stick.)
    <div className="relative flex min-h-screen flex-col overflow-x-hidden">
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
      {/* Content region — grows to fill so the Footer sticks to the bottom. Not a
          <main> (some pages render their own <main>, which mustn't nest). */}
      <div className="flex flex-1 flex-col">
        <Outlet />
      </div>
      <Footer />
    </div>
  );
};

export default Layout;
