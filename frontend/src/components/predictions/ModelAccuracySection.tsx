import { ChartInfoPopover } from "@/components/common/ChartInfoPopover";
import { PlotlyChart } from "@/components/common/PlotlyChart";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { MODEL_ACCURACY_INFO } from "@/content/chartInfo";
import { useCourseProfileData } from "@/hooks/useCourseProfileData";
import { useModelData } from "@/hooks/useModelData";
import { buildModelAccuracyModel } from "@/lib/modelAccuracy";
import { useDashboard } from "@/state/DashboardContext";

export function ModelAccuracySection() {
  const modelData = useModelData();
  const courseData = useCourseProfileData();
  const { selectedYear, selectedGroup } = useDashboard();
  const headerActions = (
    <div className="section-toolbar">
      <ChartInfoPopover title="Model Accuracy" info={MODEL_ACCURACY_INFO} />
    </div>
  );

  if (modelData.isLoading || courseData.isLoading) {
    return (
      <SectionCard title="Model Accuracy" headerActions={headerActions}>
        <StateBlock
          title="Loading"
          description="Preparing test-set accuracy."
        />
      </SectionCard>
    );
  }

  if (modelData.error || courseData.error) {
    return (
      <SectionCard title="Model Accuracy" headerActions={headerActions}>
        <StateBlock
          title="Load failed"
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
    <SectionCard title="Model Accuracy" headerActions={headerActions}>
      <div className="section-stack">
        {model.warning ? (
          <StateBlock
            title="Note"
            description={model.warning}
            tone="warning"
          />
        ) : null}

        {model.figure ? (
          <PlotlyChart
            data={model.figure.data}
            layout={model.figure.layout}
            className="plot-card--focus"
            htmlLegend
          />
        ) : (
          <StateBlock
            title="No data"
            description="No evaluation data for this filter."
            tone="warning"
          />
        )}
      </div>
    </SectionCard>
  );
}
