import { BlackShirtProbabilitySection } from "@/components/predictions/BlackShirtProbabilitySection";
import { FrontierPaceSection } from "@/components/predictions/FrontierPaceSection";
import { ModelAccuracySection } from "@/components/predictions/ModelAccuracySection";
import { Probability3DSection } from "@/components/predictions/Probability3DSection";

export function ModelPredictionsPage() {
  return (
    <div className="dashboard-page">
      <ModelAccuracySection />
      <BlackShirtProbabilitySection />
      <FrontierPaceSection />
      <Probability3DSection />
    </div>
  );
}
