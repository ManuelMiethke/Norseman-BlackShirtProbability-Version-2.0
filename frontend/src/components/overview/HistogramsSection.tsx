import { useState } from "react";

import { PlotlyChart } from "@/components/common/PlotlyChart";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { buildHistogramModel, type HistogramScaleMode } from "@/lib/histograms";
import { useDashboard } from "@/state/DashboardContext";

const SCALE_OPTIONS: HistogramScaleMode[] = [
  "Absolute (hh:mm:ss)",
  "Relative (% vs median)",
  "Bike-Time scale (min swim → 10h)",
];

export function HistogramsSection() {
  const { rows, selectedYear, selectedGroup, isLoading } = useDashboard();
  const [scaleMode, setScaleMode] = useState<HistogramScaleMode>("Absolute (hh:mm:ss)");
  const cardClassName = "overview-card overview-card--histograms";

  if (isLoading) {
    return (
      <SectionCard title="Time Distribution" className={cardClassName}>
        <StateBlock
          title="Loading"
          description="Preparing distributions."
        />
      </SectionCard>
    );
  }

  const { figures, warning } = buildHistogramModel(rows, selectedYear, selectedGroup, scaleMode);

  return (
    <SectionCard title="Time Distribution" className={cardClassName}>
      <div className="section-stack">
        <div className="section-controls">
          <div className="segmented-control" role="tablist" aria-label="Histogram scale mode">
            {SCALE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={
                  option === scaleMode
                    ? "segmented-control__button segmented-control__button--active"
                    : "segmented-control__button"
                }
                onClick={() => setScaleMode(option)}
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

        {figures.length > 0 ? (
          <div className="plot-grid plot-grid--2">
            {figures.map((figure) => (
              <PlotlyChart
                key={figure.key}
                data={figure.data}
                layout={figure.layout}
                className="plot-card--tall"
              />
            ))}
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
