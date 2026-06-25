import { useState } from "react";

import { ChartInfoPopover } from "@/components/common/ChartInfoPopover";
import { PlotlyChart } from "@/components/common/PlotlyChart";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { YEAR_COMPARISON_INFO } from "@/content/chartInfo";
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
  const headerActions = <ChartInfoPopover title="Year Comparison" info={YEAR_COMPARISON_INFO} />;
  const footerControls = (
    <div className="section-controls section-controls--footer">
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
  );

  if (isLoading) {
    return (
      <SectionCard
        title="Year Comparison"
        className={cardClassName}
        headerActions={headerActions}
      >
        <StateBlock
          title="Loading"
          description="Preparing yearly medians."
        />
      </SectionCard>
    );
  }

  const { figure, warning } = buildYearComparisonModel(rows, selectedGroup, mode);

  return (
    <SectionCard
      title="Year Comparison"
      className={cardClassName}
      headerActions={headerActions}
    >
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

      {footerControls}
    </SectionCard>
  );
}
