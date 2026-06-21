import { PlotlyChart } from "@/components/common/PlotlyChart";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { useLongData } from "@/hooks/useLongData";
import { buildPacingHeatmapModel } from "@/lib/pacingHeatmap";
import { useDashboard } from "@/state/DashboardContext";

export function PacingHeatmapSection() {
  const longData = useLongData();
  const { selectedYear, selectedGroup } = useDashboard();

  if (longData.isLoading) {
    return (
      <SectionCard
        title="Pacing Heatmap"
        description="This React section preserves the original split-by-split pacing heatmap from the Streamlit route."
      >
        <StateBlock
          title="Loading pacing heatmap"
          description="Preparing athlete-level split deltas against the median pacing profile."
        />
      </SectionCard>
    );
  }

  if (longData.error) {
    return (
      <SectionCard
        title="Pacing Heatmap"
        description="This React section preserves the original split-by-split pacing heatmap from the Streamlit route."
      >
        <StateBlock
          title="Heatmap data load failed"
          description={longData.error}
          tone="error"
        />
      </SectionCard>
    );
  }

  const model = buildPacingHeatmapModel(
    longData.rows,
    selectedYear,
    selectedGroup,
  );

  return (
    <SectionCard
      title="Pacing Heatmap"
      description="Each cell shows how much faster or slower one athlete was versus the split median. The React version keeps the original athlete ordering by finisher category and overall rank."
    >
      <div className="section-stack">
        <div className="section-note">
          <strong>Filter behavior</strong>
          <span>
            The year and group filters are applied directly here. Finish-line splits,
            transition markers and the imputed `bike_152km_end_imingfjell` split stay
            excluded, matching the original Streamlit heatmap semantics.
          </span>
        </div>

        {model.warning ? (
          <StateBlock
            title="Heatmap filter note"
            description={model.warning}
            tone="warning"
          />
        ) : null}

        {model.figure ? (
          <PlotlyChart
            data={model.figure.data}
            layout={model.figure.layout}
            className="plot-card--heatmap"
          />
        ) : (
          <StateBlock
            title="No heatmap available"
            description="No pacing heatmap data is available for the current filter selection."
            tone="warning"
          />
        )}
      </div>
    </SectionCard>
  );
}
