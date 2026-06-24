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
      <SectionCard title="Pacing Heatmap">
        <StateBlock
          title="Loading"
          description="Preparing heatmap."
        />
      </SectionCard>
    );
  }

  if (longData.error) {
    return (
      <SectionCard title="Pacing Heatmap">
        <StateBlock
          title="Load failed"
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
    <SectionCard title="Pacing Heatmap">
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
            className="plot-card--heatmap"
          />
        ) : (
          <StateBlock
            title="No data"
            description="No heatmap data for this filter."
            tone="warning"
          />
        )}
      </div>
    </SectionCard>
  );
}
