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
      <FeaturedCourses />
      <StartHere />
      <CourseHub />

      <MilestoneSection />
      <SolutionsSection />
    </>
  );
};

export default Index;
