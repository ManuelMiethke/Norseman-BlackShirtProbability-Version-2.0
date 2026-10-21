import { ChartInfoPopover } from "@/components/common/ChartInfoPopover";
import { PlotlyChart } from "@/components/common/PlotlyChart";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { BLACK_SHIRT_PROBABILITY_INFO } from "@/content/chartInfo";
import { useModelData } from "@/hooks/useModelData";
import { buildBlackShirtProbabilityModel } from "@/lib/blackShirtProbability";
import { useDashboard } from "@/state/DashboardContext";

export function BlackShirtProbabilitySection() {
  const modelData = useModelData();
  const { selectedYear, selectedGroup } = useDashboard();
  const headerActions = (
    <div className="section-toolbar">
      <ChartInfoPopover title="Black Shirt Probability" info={BLACK_SHIRT_PROBABILITY_INFO} />
    </div>
  );

  if (modelData.isLoading) {
    return (
      <SectionCard title="Black Shirt Probability" headerActions={headerActions}>
        <StateBlock
          title="Loading"
          description="Preparing probability curves."
        />
      </SectionCard>
    );
  }

  if (modelData.error) {
    return (
      <SectionCard title="Black Shirt Probability" headerActions={headerActions}>
        <StateBlock
          title="Load failed"
          description={modelData.error}
          tone="error"
        />
      </SectionCard>
    );
  }

  const model = buildBlackShirtProbabilityModel(
    modelData.rows,
    selectedYear,
    selectedGroup,
  );

  return (
    <SectionCard title="Black Shirt Probability" headerActions={headerActions}>
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
            description="No probability data for this filter."
            tone="warning"
          />
        )}
      </div>
    </SectionCard>
  );
}
