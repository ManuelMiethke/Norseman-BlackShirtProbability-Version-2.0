import { ChartInfoPopover } from "@/components/common/ChartInfoPopover";
import { PlotlyChart } from "@/components/common/PlotlyChart";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { ACCUMULATED_PROGRESS_INFO } from "@/content/chartInfo";
import { useLongData } from "@/hooks/useLongData";
import { buildAccumulatedModel } from "@/lib/pacingAccumulated";
import { useDashboard } from "@/state/DashboardContext";

export function AccumulatedProgressSection() {
  const longData = useLongData();
  const { selectedYear, selectedGroup } = useDashboard();
  const headerActions = (
    <div className="section-toolbar">
      <ChartInfoPopover title="Race Progress" info={ACCUMULATED_PROGRESS_INFO} />
    </div>
  );

  if (longData.isLoading) {
    return (
      <SectionCard title="Race Progress" headerActions={headerActions}>
        <StateBlock
          title="Loading"
          description="Preparing progress lines."
        />
      </SectionCard>
    );
  }

  if (longData.error) {
    return (
      <SectionCard title="Race Progress" headerActions={headerActions}>
        <StateBlock
          title="Load failed"
          description={longData.error}
          tone="error"
        />
      </SectionCard>
    );
  }

  const { figure, warning } = buildAccumulatedModel(
    longData.rows,
    selectedYear,
    selectedGroup,
  );

  return (
    <SectionCard title="Race Progress" headerActions={headerActions}>
      <div className="section-stack">
        {warning ? (
          <StateBlock
            title="Note"
            description={warning}
            tone="warning"
          />
        ) : null}

        {figure ? (
          <PlotlyChart
            htmlLegend
            data={figure.data}
            layout={figure.layout}
            className="plot-card--hero"
          />
        ) : null}
      </div>
    </SectionCard>
  );
}
