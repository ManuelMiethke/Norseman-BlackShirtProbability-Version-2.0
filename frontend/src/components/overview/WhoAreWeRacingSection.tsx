import { PlotlyChart } from "@/components/common/PlotlyChart";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { useLongData } from "@/hooks/useLongData";
import { buildWhoAreWeRacingModel } from "@/lib/whoAreWeRacing";

export function WhoAreWeRacingSection() {
  const { rows, isLoading, error } = useLongData();

  if (isLoading) {
    return (
      <SectionCard
        title="Who Are We Racing?"
        description="This section uses the packaged long split dataset to compare outcome groups and empirical cut-off pressure across years."
      >
        <StateBlock
          title="Loading split history"
          description="Reading long-format split data for the all-years outcome and frontier charts."
        />
      </SectionCard>
    );
  }

  if (error) {
    return (
      <SectionCard
        title="Who Are We Racing?"
        description="This section uses the packaged long split dataset to compare outcome groups and empirical cut-off pressure across years."
      >
        <StateBlock
          title="Split dataset load failed"
          description={error}
          tone="error"
        />
      </SectionCard>
    );
  }

  const { outcomesFigure, frontierFigure, frontierMedianHours, warning } = buildWhoAreWeRacingModel(rows);

  return (
    <SectionCard
      title="Who Are We Racing?"
      description="This preserves the original long-data section that compares yearly outcome mixes and the empirical Black Shirt frontier. Like the Streamlit version, it intentionally ignores the global year and group filters."
    >
      <div className="section-stack">
        <div className="section-note">
          <strong>Cross-year context</strong>
          <span>
            This module always uses the full packaged long split history. It shows how Black Shirts, White finishers, competition misses and hardcoded DNF counts shift across race editions.
          </span>
        </div>

        {warning ? (
          <StateBlock
            title="Computation note"
            description={warning}
            tone="warning"
          />
        ) : null}

        {outcomesFigure ? (
          <PlotlyChart
            data={outcomesFigure.data}
            layout={outcomesFigure.layout}
            className="plot-card--tall"
          />
        ) : null}

        {frontierMedianHours !== null ? (
          <div className="section-note">
            <strong>Empirical Black Shirt pace</strong>
            <span>
              Median time of rank ~160 at the 37.5 km cut-off in 2024–2025: {frontierMedianHours.toFixed(2)} hours.
            </span>
          </div>
        ) : null}

        {frontierFigure ? (
          <PlotlyChart
            data={frontierFigure.data}
            layout={frontierFigure.layout}
          />
        ) : null}
      </div>
    </SectionCard>
  );
}
