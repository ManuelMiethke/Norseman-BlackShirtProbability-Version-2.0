import { useState } from "react";

import { ChartInfoPopover } from "@/components/common/ChartInfoPopover";
import type { ChartLegendItem } from "@/components/common/ChartLegend";
import { PlotlyChart } from "@/components/common/PlotlyChart";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { FRONTIER_PACE_INFO } from "@/content/chartInfo";
import { useCourseProfileData } from "@/hooks/useCourseProfileData";
import { useLongData } from "@/hooks/useLongData";
import { useModelData } from "@/hooks/useModelData";
import { buildFrontierPaceModel } from "@/lib/frontierPace";
import { PALETTE } from "@/lib/theme";
import { useDashboard } from "@/state/DashboardContext";

const RELATIVE_LEGEND: ChartLegendItem[] = [
  { label: "Top 10", color: PALETTE.top10, shape: "line" },
  { label: "Black Shirt", color: PALETTE.black, shape: "line" },
  { label: "White Shirt", color: PALETTE.white, shape: "line" },
  { label: "DNF", color: PALETTE.dnf, shape: "line" },
  { label: "Frontier", color: PALETTE.frontier, shape: "dash" },
];

const VIEW_OPTIONS = [
  { label: "Accumulated overlay", value: "absolute" as const },
  { label: "Relative to frontier", value: "relative" as const },
];

export function FrontierPaceSection() {
  const modelData = useModelData();
  const longData = useLongData();
  const courseData = useCourseProfileData();
  const { selectedYear, selectedGroup } = useDashboard();
  const [mode, setMode] = useState<(typeof VIEW_OPTIONS)[number]["value"]>("absolute");
  const headerActions = <ChartInfoPopover title="Frontier Pace" info={FRONTIER_PACE_INFO} />;
  const footerControls = (
    <div className="section-controls section-controls--footer">
      <div className="segmented-control" role="tablist" aria-label="Frontier comparison mode">
        {VIEW_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={
              mode === option.value
                ? "segmented-control__button segmented-control__button--active"
                : "segmented-control__button"
            }
            onClick={() => setMode(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );

  if (modelData.isLoading || longData.isLoading || courseData.isLoading) {
    return (
      <SectionCard title="Frontier Pace" headerActions={headerActions}>
        <StateBlock title="Loading" description="Preparing 50% frontier pace." />
      </SectionCard>
    );
  }

  const error = modelData.error ?? longData.error ?? courseData.error;
  if (error) {
    return (
      <SectionCard title="Frontier Pace" headerActions={headerActions}>
        <StateBlock title="Load failed" description={error} tone="error" />
      </SectionCard>
    );
  }

  const model = buildFrontierPaceModel(
    modelData.rows,
    longData.rows,
    courseData.rows,
    selectedYear,
    selectedGroup,
    mode,
  );

  return (
    <SectionCard title="Frontier Pace" headerActions={headerActions}>
      <div className="section-stack">
        {model.warning ? <StateBlock title="Note" description={model.warning} tone="warning" /> : null}

        {model.chartFigure ? (
          <PlotlyChart
            data={model.chartFigure.data}
            layout={model.chartFigure.layout}
            className="plot-card--hero"
            title="50 % frontier pace along the course"
            htmlLegend
            headerExtra={
              model.totalTimeLabel ? (
                <>
                  Frontier time at cut-off <strong>{model.totalTimeLabel}</strong>
                </>
              ) : null
            }
          />
        ) : null}

        {model.accumulatedFigure ? (
          <PlotlyChart
            data={model.accumulatedFigure.data}
            layout={model.accumulatedFigure.layout}
            className="plot-card--hero"
            title={mode === "absolute" ? "Accumulated time vs frontier" : "Time gap to the frontier"}
            htmlLegend={mode === "absolute"}
            legend={mode === "relative" ? RELATIVE_LEGEND : undefined}
          />
        ) : null}

        {footerControls}
      </div>
    </SectionCard>
  );
}
