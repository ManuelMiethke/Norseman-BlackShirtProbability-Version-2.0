import { BlackShirtProbabilitySection } from "@/components/predictions/BlackShirtProbabilitySection";
import { ModelAccuracySection } from "@/components/predictions/ModelAccuracySection";

export function ModelPredictionsPage() {
  return (
    <div className="dashboard-page">
      <div className="dashboard-grid dashboard-grid--two">
        <ModelAccuracySection />
        <BlackShirtProbabilitySection />
      </div>
    </div>
  );
}
