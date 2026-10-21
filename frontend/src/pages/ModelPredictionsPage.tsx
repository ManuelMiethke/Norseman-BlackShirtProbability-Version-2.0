import { BlackShirtProbabilitySection } from "@/components/predictions/BlackShirtProbabilitySection";
import { FrontierPaceSection } from "@/components/predictions/FrontierPaceSection";
import { ModelAccuracySection } from "@/components/predictions/ModelAccuracySection";
import { Probability3DSection } from "@/components/predictions/Probability3DSection";
import { useDashboard } from "@/state/DashboardContext";

const HOLDOUT_YEAR = 2026;

function modelSourceText(year: number | "All") {
  if (year === "All") {
    return "2018–2025: earlier model, random 80/20 split per year (test rows only). 2026: holdout model trained on 2018–2025 – the whole race was unseen.";
  }
  if (year === HOLDOUT_YEAR) {
    return "Holdout model trained on 2018–2025 – the full 2026 race was never seen during training.";
  }
  return `Earlier model with a random 80/20 split per year – only the ${year} test rows (≈ 20 %) are shown.`;
}

export function ModelPredictionsPage() {
  const { selectedYear } = useDashboard();

  return (
    <div className="dashboard-page">
      <div className="page-banner" role="note">
        <span className="page-banner__label">Model data</span>
        <span>{modelSourceText(selectedYear)}</span>
      </div>
      <ModelAccuracySection />
      <BlackShirtProbabilitySection />
      <FrontierPaceSection />
      <Probability3DSection />
    </div>
  );
}
