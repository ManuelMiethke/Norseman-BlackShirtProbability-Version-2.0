import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { CatchupSection } from "@/components/tools/CatchupSection";

export function ToolsPage() {
  return (
    <div className="page-stack">
      <section className="page-hero">
        <div>
          <span className="page-hero__eyebrow">Tools</span>
          <h1>React tools migration</h1>
          <p>
            This route now starts with the original catch-up estimator in React. The
            heavier empirical pacing planner stays queued behind it so the tools page
            can move in controlled slices.
          </p>
        </div>
        <div className="page-hero__badge">
          <strong>Phase 4</strong>
          <span>Catch-up added</span>
        </div>
      </section>

      <CatchupSection />

      <SectionCard
        title="Next Tools Module"
        description="The remaining Streamlit analysis on this route is more complex, but it can now build on the same shared React shell and model-data hook."
      >
        <div className="section-stack">
          <StateBlock
            title="Queued next"
            description="`empirical_pace` is still pending. The route now has the original odds/required-pace estimator, leaving the empirical pacing planner as the last major Streamlit-only tool."
          />
        </div>
      </SectionCard>
    </div>
  );
}
