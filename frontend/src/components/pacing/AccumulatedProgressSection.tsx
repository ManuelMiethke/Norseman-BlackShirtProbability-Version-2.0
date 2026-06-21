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
      <SectionCard
        title="Accumulated Race Progress"
        description="This section ports the original cumulative race-progress chart for the currently selected year and finisher group."
      >
        <StateBlock
          title="Loading accumulated progress"
          description="Preparing athlete-level cumulative distance and time traces from the long split dataset."
        />
      </SectionCard>
    );
  }

  if (longData.error) {
    return (
      <SectionCard
        title="Accumulated Race Progress"
        description="This section ports the original cumulative race-progress chart for the currently selected year and finisher group."
      >
        <StateBlock
          title="Split dataset load failed"
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
    <SectionCard
      title="Accumulated Race Progress"
      description="Each line represents one athlete’s cumulative race time over distance. The React version keeps the original leg-separated distance axis and the same group semantics as the Streamlit chart."
    >
      <div className="section-stack">
        <div className="section-note">
          <strong>Filter behavior</strong>
          <span>
            This chart follows the global year and finisher-group filters directly. In multi-year mode it intentionally overlays all matching years, matching the original Streamlit behavior.
          </span>
        </div>

        {warning ? (
          <StateBlock
            title="Accumulated progress unavailable"
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
