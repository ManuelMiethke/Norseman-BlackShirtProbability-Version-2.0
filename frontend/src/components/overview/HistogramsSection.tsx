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

  if (isLoading) {
    return (
      <SectionCard
        title="Time Distributions"
        description="This React section ports the original overview histograms for swim, bike, run-to-cutoff and total time-to-cutoff."
      >
        <StateBlock
          title="Loading time distributions"
          description="Preparing athlete-level timing distributions from the shared race dataset."
        />
      </SectionCard>
    );
  }

  const { figures, warning } = buildHistogramModel(rows, selectedYear, selectedGroup, scaleMode);

  return (
    <SectionCard
      title="Time Distributions"
      description="This keeps the original distribution logic, including the group-aware Top-10 overlay, the relative-to-median view and the bike-scale comparison mode."
    >
      <div className="section-stack">
        <div className="section-controls section-controls--stacked">
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

          <div className="section-note">
            <strong>Selection context</strong>
            <span>
              The current charts use year filter "{selectedYear}" and group filter "{selectedGroup}". The Top-10 trace remains an explicit overlay inside the filtered population, matching the original Streamlit behavior.
            </span>
          </div>
        </div>

        {warning ? (
          <StateBlock
            title="Distribution unavailable"
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
              />
            ))}
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
