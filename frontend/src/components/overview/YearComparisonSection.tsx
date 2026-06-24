import { useState } from "react";

import { PlotlyChart } from "@/components/common/PlotlyChart";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import {
  buildYearComparisonModel,
  type YearComparisonMode,
} from "@/lib/yearComparison";
import { useDashboard } from "@/state/DashboardContext";

const MODE_OPTIONS: YearComparisonMode[] = [
  "Time Overview",
  "Compared to 2025",
  "Trend",
];

export function YearComparisonSection() {
  const { rows, selectedGroup, isLoading } = useDashboard();
  const [mode, setMode] = useState<YearComparisonMode>("Time Overview");
  const cardClassName = "overview-card overview-card--year";

  if (isLoading) {
    return (
      <SectionCard title="Year Comparison" className={cardClassName}>
        <StateBlock
          title="Loading"
          description="Preparing yearly medians."
        />
      </SectionCard>
    );
  }

  const { figure, warning } = buildYearComparisonModel(rows, selectedGroup, mode);

  return (
    <SectionCard title="Year Comparison" className={cardClassName}>
      <div className="section-controls">
        <div className="segmented-control" role="tablist" aria-label="Year comparison mode">
          {MODE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={
                option === mode
                  ? "segmented-control__button segmented-control__button--active"
                  : "segmented-control__button"
              }
              onClick={() => setMode(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

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
          className="plot-card--focus"
        />
      ) : null}
    </SectionCard>
  );
}
