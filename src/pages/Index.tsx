import HeroSection from "@/components/HeroSection";
import StartHere from "@/components/StartHere";
import CourseHub from "@/components/CourseHub";
import SolutionsSection from "@/components/solutions/SolutionsSection";

const Index = () => {
  return (
    <>
      {/* StartHere opens the page (owner's call): the first thing a visitor
          should see is 「开始你的旅程」, not the headline.

          This reverses the previous arrangement, and the cost is real and
          accepted: 「参加 Coaching」 is step 2 of this section, but the
          Coaching Night panel it points at lives inside <HeroSection> BELOW —
          so the invitation now arrives before the thing it refers to. The
          panel also drops off the first screen (~1310px in, vs 555 before),
          which means its autoplay gate no longer fires on load; it fires when
          the reader scrolls down to it. Left as-is on purpose. */}
      <StartHere />
      <HeroSection />
      <CourseHub />
      <SolutionsSection />
    </>
  );
};

export default Index;
