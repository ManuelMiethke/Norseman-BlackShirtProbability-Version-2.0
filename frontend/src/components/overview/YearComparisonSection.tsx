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
import { LATEST_YEAR } from "@/config/raceRegistry";
import { useDashboard } from "@/state/DashboardContext";

const MODE_OPTIONS: YearComparisonMode[] = [
  "Time Overview",
  "Compared to baseline",
];

export function YearComparisonSection() {
  const { rows, selectedGroup, isLoading } = useDashboard();
  const [mode, setMode] = useState<YearComparisonMode>("Time Overview");
  const [zoomOverallDifferences, setZoomOverallDifferences] = useState(false);
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
            {option === "Compared to baseline" ? `Compared to ${LATEST_YEAR}` : option}
          </button>
        ))}
      </div>

      <div className="segmented-control" role="group" aria-label="Overall finish time detail">
        <button
          type="button"
          className={
            zoomOverallDifferences
              ? "segmented-control__button segmented-control__button--active"
              : "segmented-control__button"
          }
          aria-pressed={zoomOverallDifferences}
          onClick={() => setZoomOverallDifferences((current) => !current)}
        >
          Zoomed time differences
        </button>
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

  const {
    comparisonFigure,
    overallFigure,
    warning,
    comparisonWarning,
    overallWarning,
  } = buildYearComparisonModel(rows, selectedGroup, mode, zoomOverallDifferences);

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

      <div className="year-comparison-grid">
        {comparisonFigure ? (
          <PlotlyChart
            data={comparisonFigure.data}
            layout={comparisonFigure.layout}
            previewLayout={comparisonFigure.previewLayout}
            className="plot-card--year-comparison"
            htmlLegend
          />
        ) : (
          <StateBlock
            title="Split medians"
            description={comparisonWarning ?? "No split medians are available for this selection."}
            tone="warning"
          />
        )}

        {overallFigure ? (
          <PlotlyChart
            data={overallFigure.data}
            layout={overallFigure.layout}
            previewLayout={overallFigure.previewLayout}
            className="plot-card--year-comparison"
          />
        ) : (
          <StateBlock
            title="Overall median"
            description={overallWarning ?? "No overall finish medians are available for this selection."}
            tone="warning"
          />
        )}
      </div>

      {footerControls}
    </SectionCard>
  );
}
