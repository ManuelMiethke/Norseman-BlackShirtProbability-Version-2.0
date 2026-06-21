import { AccumulatedProgressSection } from "@/components/pacing/AccumulatedProgressSection";
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
            This route now includes the combined course profile chart plus cumulative race-progress traces. The remaining pacing modules stay queued behind them so the page can move in controlled slices.
          </p>
        </div>
        <div className="page-hero__badge">
          <strong>Phase 2</strong>
          <span>Progress added</span>
        </div>
      </section>

      <CourseWeatherSpeedSection />
      <AccumulatedProgressSection />

      <SectionCard
        title="Next Pacing Modules"
        description="The remaining Streamlit sections on this route still need to move to React after the course/weather foundation is stable."
      >
        <div className="section-stack">
          <StateBlock
            title="Queued next"
            description="`pacetabelle` and `heatmap` are still pending. The current route now has its structural course chart plus the cumulative race-progress view, which reduces the remaining work to the more specialized pacing analyses."
          />
        </div>
      </SectionCard>
    </div>
  );
}
