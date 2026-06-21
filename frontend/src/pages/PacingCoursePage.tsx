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
            The first migrated section on this route ports the combined course profile, weather checkpoints and median speed chart. The remaining pacing modules stay queued behind it so the page can move in controlled slices.
          </p>
        </div>
        <div className="page-hero__badge">
          <strong>Phase 1</strong>
          <span>Route context port</span>
        </div>
      </section>

      <CourseWeatherSpeedSection />

      <SectionCard
        title="Next Pacing Modules"
        description="The remaining Streamlit sections on this route still need to move to React after the course/weather foundation is stable."
      >
        <div className="section-stack">
          <StateBlock
            title="Queued next"
            description="`accumulated`, `pacetabelle` and `heatmap` are still pending. The current page migration intentionally starts with the largest combined chart because it defines the route’s visual structure and shared course semantics."
          />
        </div>
      </SectionCard>
    </div>
  );
}
