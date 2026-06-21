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
            This route now starts with the original timing-station accuracy chart in
            React. The remaining probability-trajectory module stays queued behind it
            so the predictions page can move in controlled slices.
          </p>
        </div>
        <div className="page-hero__badge">
          <strong>Phase 3</strong>
          <span>Accuracy added</span>
        </div>
      </section>

      <ModelAccuracySection />

      <SectionCard
        title="Next Prediction Module"
        description="The remaining Streamlit analysis on this route can now build on the same model dataset without reopening the route shell."
      >
        <div className="section-stack">
          <StateBlock
            title="Queued next"
            description="`blackshirt_prob` is still pending. The route now has the shared shell plus the original model-accuracy view, which leaves the Black-Shirt probability trajectories as the only remaining prediction-specific module."
          />
        </div>
      </SectionCard>
    </div>
  );
}
