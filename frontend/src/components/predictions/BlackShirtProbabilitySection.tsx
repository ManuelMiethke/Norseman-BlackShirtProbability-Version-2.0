import { PlotlyChart } from "@/components/common/PlotlyChart";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { useModelData } from "@/hooks/useModelData";
import { buildBlackShirtProbabilityModel } from "@/lib/blackShirtProbability";
import { useDashboard } from "@/state/DashboardContext";

export function BlackShirtProbabilitySection() {
  const modelData = useModelData();
  const { selectedYear, selectedGroup } = useDashboard();

  if (modelData.isLoading) {
    return (
      <SectionCard title="Black Shirt Probability">
        <StateBlock
          title="Loading"
          description="Preparing probability curves."
        />
      </SectionCard>
    );
  }

  if (modelData.error) {
    return (
      <SectionCard title="Black Shirt Probability">
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
    <SectionCard title="Black Shirt Probability">
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
            className="plot-card--xl"
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
