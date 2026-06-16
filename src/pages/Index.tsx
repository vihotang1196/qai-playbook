import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import FeaturedCourses from "@/components/FeaturedCourses";
import StartHere from "@/components/StartHere";
import CourseHub from "@/components/CourseHub";

import MilestoneSection from "@/components/MilestoneSection";
import SolutionsSection from "@/components/solutions/SolutionsSection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <HeroSection />
      <FeaturedCourses />
      <StartHere />
      <CourseHub />
      
      <MilestoneSection />
      <SolutionsSection />
      <Footer />
    </div>
  );
};

export default Index;
