import HeroSection from "@/components/HeroSection";
import FeaturedCourses from "@/components/FeaturedCourses";
import StartHere from "@/components/StartHere";
import CourseHub from "@/components/CourseHub";

import MilestoneSection from "@/components/MilestoneSection";
import SolutionsSection from "@/components/solutions/SolutionsSection";

const Index = () => {
  return (
    <>
      <HeroSection />
      {/* StartHere sits directly under the hero: its second step is 「参加
          Coaching」, and the Coaching Night panel lives inside <HeroSection>,
          so the reader meets the invitation after the thing it points at, not
          before it. Above the hero it would also push the headline, the three
          CTAs and Coaching Night all past the first screen — that section is
          1815px tall on its own. */}
      <StartHere />
      <FeaturedCourses />
      <CourseHub />

      <MilestoneSection />
      <SolutionsSection />
    </>
  );
};

export default Index;
