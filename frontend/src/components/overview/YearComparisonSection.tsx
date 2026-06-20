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

  if (isLoading) {
    return (
      <SectionCard
        title="Year Comparison"
        description="This React section keeps the original cross-year comparison of median split times and finish trends."
      >
        <StateBlock
          title="Loading year comparison"
          description="Preparing the all-years split medians from the shared race dataset."
        />
      </SectionCard>
    );
  }

  const { figure, tableRows, warning } = buildYearComparisonModel(rows, selectedGroup, mode);

  return (
    <SectionCard
      title="Year Comparison"
      description="Median swim, bike and run-to-32.5 km times are compared across all race years. This preserves the original Overview chart and intentionally ignores the global year filter so cross-year patterns stay visible."
    >
      <div className="section-controls section-controls--stacked">
        <div className="section-note">
          <strong>Cross-year mode</strong>
          <span>
            The toolbar year filter is intentionally not applied here. The section always compares all available years for the currently selected finisher group.
          </span>
        </div>

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
          title="Comparison warning"
          description={warning}
          tone="warning"
        />
      ) : null}

      {figure ? (
        <PlotlyChart
          data={figure.data}
          layout={figure.layout}
          className="plot-card--tall"
        />
      ) : null}

      {tableRows.length > 0 ? (
        <div className="table-panel">
          <div className="table-panel__header">
            <div>
              <h4>Median split table</h4>
              <p>Reference medians for the same yearly comparison block.</p>
            </div>
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Swim</th>
                  <th>Bike</th>
                  <th>Run to 32.5 km</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => (
                  <tr key={row.year}>
                    <td>{row.year}</td>
                    <td>{row.swim}</td>
                    <td>{row.bike}</td>
                    <td>{row.runTo325Km}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}
