import { AccumulatedProgressSection } from "@/components/pacing/AccumulatedProgressSection";
import { PaceDistributionSection } from "@/components/pacing/PaceDistributionSection";
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
            This route now includes the combined course profile chart, cumulative race-progress traces and the leg-wise pace distribution block. Only the pacing heatmap is still queued behind them so the page can move in controlled slices.
          </p>
        </div>
        <div className="page-hero__badge">
          <strong>Phase 2</strong>
          <span>Distributions added</span>
        </div>
      </section>

      <CourseWeatherSpeedSection />
      <AccumulatedProgressSection />
      <PaceDistributionSection />

      <SectionCard
        title="Next Pacing Modules"
        description="The remaining Streamlit sections on this route still need to move to React after the course/weather foundation is stable."
      >
        <div className="section-stack">
          <StateBlock
            title="Queued next"
            description="Only `heatmap` is still pending on this route. The current page now covers the structural course chart, cumulative race progress and the original pace distribution block, which reduces the remaining work to the athlete-level pacing heatmap."
          />
        </div>
      </SectionCard>
    </div>
  );
}
