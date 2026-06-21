import { AccumulatedProgressSection } from "@/components/pacing/AccumulatedProgressSection";
import { PaceDistributionSection } from "@/components/pacing/PaceDistributionSection";
import { PacingHeatmapSection } from "@/components/pacing/PacingHeatmapSection";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { CourseWeatherSpeedSection } from "@/components/pacing/CourseWeatherSpeedSection";

export function PacingCoursePage() {
  return (
    <div className="page-stack">
      <section className="page-hero">
        <div>
          <span className="page-hero__eyebrow">Pacing & Course</span>
          <h1>React pacing migration</h1>
          <p>
            This route now covers the full original `Pacing & Course` analytics set in React, keeping the Plotly-based pacing visuals while replacing the Streamlit presentation layer.
          </p>
        </div>
        <div className="page-hero__badge">
          <strong>Phase 2</strong>
          <span>Route complete</span>
        </div>
      </section>

      <CourseWeatherSpeedSection />
      <AccumulatedProgressSection />
      <PaceDistributionSection />
      <PacingHeatmapSection />

      <SectionCard
        title="Next Route Focus"
        description="The Pacing & Course route is now complete in React. The remaining migration work moves to the other Streamlit-only routes."
      >
        <div className="section-stack">
          <StateBlock
            title="Queued next"
            description="The next React targets are `Model Predictions` and `Tools`, plus the follow-up work of slimming the frontend data contract so the browser does not need to parse broad CSV assets for every route."
          />
        </div>
      </SectionCard>
    </div>
  );
}
