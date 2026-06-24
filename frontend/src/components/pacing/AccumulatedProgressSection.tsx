import { PlotlyChart } from "@/components/common/PlotlyChart";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { useLongData } from "@/hooks/useLongData";
import { buildAccumulatedModel } from "@/lib/pacingAccumulated";
import { useDashboard } from "@/state/DashboardContext";

export function AccumulatedProgressSection() {
  const longData = useLongData();
  const { selectedYear, selectedGroup } = useDashboard();

  if (longData.isLoading) {
    return (
      <SectionCard title="Race Progress">
        <StateBlock
          title="Loading"
          description="Preparing progress lines."
        />
      </SectionCard>
    );
  }

  if (longData.error) {
    return (
      <SectionCard title="Race Progress">
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
    <SectionCard title="Race Progress">
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
            data={figure.data}
            layout={figure.layout}
            className="plot-card--xl"
          />
        ) : null}
      </div>
    </SectionCard>
  );
}
