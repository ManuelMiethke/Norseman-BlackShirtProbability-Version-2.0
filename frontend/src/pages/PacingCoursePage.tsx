import { AccumulatedProgressSection } from "@/components/pacing/AccumulatedProgressSection";
import { PaceDistributionSection } from "@/components/pacing/PaceDistributionSection";
import { PacingHeatmapSection } from "@/components/pacing/PacingHeatmapSection";
import { CourseWeatherSpeedSection } from "@/components/pacing/CourseWeatherSpeedSection";

export function PacingCoursePage() {
  return (
    <div className="dashboard-page">
      <div className="dashboard-grid">
        <CourseWeatherSpeedSection />
        <AccumulatedProgressSection />
        <PaceDistributionSection />
        <PacingHeatmapSection />
      </div>
    </div>
  );
}
