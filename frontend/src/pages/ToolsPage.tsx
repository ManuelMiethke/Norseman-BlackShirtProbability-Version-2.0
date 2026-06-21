import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { CatchupSection } from "@/components/tools/CatchupSection";
import { EmpiricalPaceSection } from "@/components/tools/EmpiricalPaceSection";

export function ToolsPage() {
  return (
    <div className="page-stack">
      <section className="page-hero">
        <div>
          <span className="page-hero__eyebrow">Tools</span>
          <h1>React tools migration</h1>
          <p>
            This route now includes the catch-up estimator plus the interactive core of
            the empirical pacing planner. Only the detailed empirical course/speed
            figure is still queued behind them so the tools page can move in controlled
            slices.
          </p>
        </div>
        <div className="page-hero__badge">
          <strong>Phase 4</strong>
          <span>Planner core added</span>
        </div>
      </section>

      <CatchupSection />
      <EmpiricalPaceSection />

      <SectionCard
        title="Next Tools Module"
        description="The remaining Streamlit analysis on this route is more complex, but it can now build on the same shared React shell and model-data hook."
      >
        <div className="section-stack">
          <StateBlock
            title="Queued next"
            description="The remaining work is now inside the empirical pacing module itself: the detailed course-elevation and recommended-speed chart is still pending. The catch-up estimator and the planning controls/table are already ported."
          />
        </div>
      </SectionCard>
    </div>
  );
}
