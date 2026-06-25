import { ChartInfoPopover } from "@/components/common/ChartInfoPopover";
import { PlotlyChart } from "@/components/common/PlotlyChart";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { PACING_HEATMAP_INFO } from "@/content/chartInfo";
import { useLongData } from "@/hooks/useLongData";
import { buildPacingHeatmapModel } from "@/lib/pacingHeatmap";
import { useDashboard } from "@/state/DashboardContext";

export function PacingHeatmapSection() {
  const longData = useLongData();
  const { selectedYear, selectedGroup } = useDashboard();
  const headerActions = (
    <div className="section-toolbar">
      <ChartInfoPopover title="Pacing Heatmap" info={PACING_HEATMAP_INFO} />
    </div>
  );

  if (longData.isLoading) {
    return (
      <SectionCard title="Pacing Heatmap" headerActions={headerActions}>
        <StateBlock
          title="Loading"
          description="Preparing heatmap."
        />
      </SectionCard>
    );
  }

  if (longData.error) {
    return (
      <SectionCard title="Pacing Heatmap" headerActions={headerActions}>
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
    <SectionCard title="Pacing Heatmap" headerActions={headerActions}>
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
