import { PlotlyChart } from "@/components/common/PlotlyChart";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { useCourseProfileData } from "@/hooks/useCourseProfileData";
import { useModelData } from "@/hooks/useModelData";
import { buildModelAccuracyModel } from "@/lib/modelAccuracy";
import { useDashboard } from "@/state/DashboardContext";

export function ModelAccuracySection() {
  const modelData = useModelData();
  const courseData = useCourseProfileData();
  const { selectedYear, selectedGroup } = useDashboard();

  if (modelData.isLoading || courseData.isLoading) {
    return (
      <SectionCard
        title="Model Accuracy"
        description="This React section preserves the original station-by-station model-accuracy chart from the Streamlit prediction route."
      >
        <StateBlock
          title="Loading model accuracy"
          description="Preparing test-set predictions and course-profile context for the selected filter combination."
        />
      </SectionCard>
    );
  }

  if (modelData.error || courseData.error) {
    return (
      <SectionCard
        title="Model Accuracy"
        description="This React section preserves the original station-by-station model-accuracy chart from the Streamlit prediction route."
      >
        <StateBlock
          title="Prediction data load failed"
          description={modelData.error ?? courseData.error ?? "Unknown data loading error."}
          tone="error"
        />
      </SectionCard>
    );
  }

  const model = buildModelAccuracyModel(
    modelData.rows,
    courseData.rows,
    selectedYear,
    selectedGroup,
  );

  return (
    <SectionCard
      title="Model Accuracy by Timing Station"
      description="The amber line shows how accurately the test-set model classifies the final Black/White outcome at each timing station, while the colored elevation backdrop preserves the original slope-aware course context."
    >
      <div className="section-stack">
        <div className="section-note">
          <strong>Prediction scope</strong>
          <span>
            This section intentionally uses only the packaged model test set, matching
            the Streamlit module. Year and group filters are applied on top of that
            evaluation slice.
          </span>
        </div>

        {model.warning ? (
          <StateBlock
            title="Accuracy filter note"
            description={model.warning}
            tone="warning"
          />
        ) : null}

        {model.figure ? (
          <PlotlyChart
            data={model.figure.data}
            layout={model.figure.layout}
            className="plot-card--xl"
          />
        ) : (
          <StateBlock
            title="No accuracy chart available"
            description="No model-evaluation data is available for the current filter selection."
            tone="warning"
          />
        )}
      </div>
    </SectionCard>
  );
}
