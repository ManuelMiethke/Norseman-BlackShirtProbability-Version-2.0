import { BlackShirtProbabilitySection } from "@/components/predictions/BlackShirtProbabilitySection";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { ModelAccuracySection } from "@/components/predictions/ModelAccuracySection";

export function ModelPredictionsPage() {
  return (
    <div className="page-stack">
      <section className="page-hero">
        <div>
          <span className="page-hero__eyebrow">Model Predictions</span>
          <h1>React prediction migration</h1>
          <p>
            This route now covers the full original prediction analytics set in React,
            preserving the Plotly-based model views while replacing the Streamlit page
            shell.
          </p>
        </div>
        <div className="page-hero__badge">
          <strong>Phase 3</strong>
          <span>Route complete</span>
        </div>
      </section>

      <ModelAccuracySection />
      <BlackShirtProbabilitySection />

      <SectionCard
        title="Next Route Focus"
        description="The `Model Predictions` route is now complete in React. The remaining migration work moves to the Streamlit-only tools route and later frontend data slimming."
      >
        <div className="section-stack">
          <StateBlock
            title="Queued next"
            description="The next React target is `Tools`, followed by the follow-up task of replacing broad CSV parsing with slimmer route-oriented frontend assets."
          />
        </div>
      </SectionCard>
    </div>
  );
}
