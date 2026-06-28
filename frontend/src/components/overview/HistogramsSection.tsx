import { useState } from "react";

import { ChartInfoPopover } from "@/components/common/ChartInfoPopover";
import { PlotlyChart } from "@/components/common/PlotlyChart";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { HISTOGRAMS_INFO } from "@/content/chartInfo";
import type { GroupOption } from "@/config/raceRegistry";
import { buildHistogramModel, type HistogramScaleMode } from "@/lib/histograms";
import { useDashboard } from "@/state/DashboardContext";

const SCALE_OPTIONS: HistogramScaleMode[] = [
  "Absolute (hh:mm:ss)",
  "Relative (% vs median)",
  "Bike-Time scale (min swim → 10h)",
];

type HistogramLegendItem = {
  label: string;
  color: string;
  borderColor?: string;
};

const HISTOGRAM_LEGEND_ITEMS: Record<GroupOption, HistogramLegendItem[]> = {
  All: [
    { label: "Black", color: "#1a1a1a" },
    { label: "White", color: "#f3f3f3", borderColor: "rgba(0, 0, 0, 0.24)" },
    { label: "DNF", color: "#db4437" },
    { label: "Top 10", color: "#86dc81" },
  ],
  "Top 10": [{ label: "Top 10", color: "#86dc81" }],
  "Black Shirt": [{ label: "Black", color: "#1a1a1a" }],
  "White Shirt": [{ label: "White", color: "#f3f3f3", borderColor: "rgba(0, 0, 0, 0.24)" }],
  DNF: [{ label: "DNF", color: "#db4437" }],
};

export function HistogramsSection() {
  const { rows, selectedYear, selectedGroup, isLoading } = useDashboard();
  const [scaleMode, setScaleMode] = useState<HistogramScaleMode>("Absolute (hh:mm:ss)");
  const cardClassName = "overview-card overview-card--histograms";
  const legendItems = HISTOGRAM_LEGEND_ITEMS[selectedGroup];
  const headerActions = (
    <div className="chart-header-cluster">
      <div className="chart-legend" aria-label="Distribution legend">
        {legendItems.map((item) => (
          <span key={item.label} className="chart-legend__item">
            <span
              className="chart-legend__swatch"
              style={{
                background: item.color,
                borderColor: item.borderColor ?? "transparent",
              }}
              aria-hidden="true"
            />
            <span>{item.label}</span>
          </span>
        ))}
      </div>
      <ChartInfoPopover title="Time Distribution" info={HISTOGRAMS_INFO} />
    </div>
  );
  const footerControls = (
    <div className="section-controls section-controls--footer">
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
  );

  if (isLoading) {
    return (
      <SectionCard
        title="Time Distribution"
        className={cardClassName}
        headerActions={headerActions}
      >
        <StateBlock
          title="Loading"
          description="Preparing distributions."
        />
      </SectionCard>
    );
  }

  const { figures, warning } = buildHistogramModel(rows, selectedYear, selectedGroup, scaleMode);

  return (
    <SectionCard
      title="Time Distribution"
      className={cardClassName}
      headerActions={headerActions}
    >
      <div className="section-stack">
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
                previewLayout={figure.previewLayout}
                className="plot-card--histogram"
              />
            ))}
          </div>
        ) : null}

        {footerControls}
      </div>
    </SectionCard>
  );
}
