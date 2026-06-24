import { useState } from "react";

import { PlotlyChart } from "@/components/common/PlotlyChart";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { useCourseProfileData } from "@/hooks/useCourseProfileData";
import { useLongData } from "@/hooks/useLongData";
import { useModelData } from "@/hooks/useModelData";
import { buildFrontierPaceModel } from "@/lib/frontierPace";
import { useDashboard } from "@/state/DashboardContext";

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

  if (modelData.isLoading || longData.isLoading || courseData.isLoading) {
    return (
      <SectionCard title="Frontier Pace">
        <StateBlock title="Loading" description="Preparing 50% frontier pace." />
      </SectionCard>
    );
  }

  const error = modelData.error ?? longData.error ?? courseData.error;
  if (error) {
    return (
      <SectionCard title="Frontier Pace">
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
    <SectionCard title="Frontier Pace">
      <div className="section-stack">
        <div className="section-controls">
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

        {model.warning ? <StateBlock title="Note" description={model.warning} tone="warning" /> : null}

        {model.chartFigure ? (
          <PlotlyChart
            data={model.chartFigure.data}
            layout={model.chartFigure.layout}
            className="plot-card--hero"
          />
        ) : null}

        {model.tableRows.length > 0 ? (
          <div className="table-panel">
            <div className="table-panel__header">
              <h4>Frontier splits</h4>
              {model.totalTimeLabel ? <p>Estimated total: {model.totalTimeLabel}</p> : null}
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Split</th>
                    <th>Distance</th>
                    <th>Segment time</th>
                    <th>Cumulative time</th>
                    <th>Frontier speed</th>
                  </tr>
                </thead>
                <tbody>
                  {model.tableRows.map((row) => (
                    <tr key={row.splitKey}>
                      <td>{row.splitKey}</td>
                      <td>{row.distanceKm} km</td>
                      <td>{row.segmentTime}</td>
                      <td>{row.cumulativeTime}</td>
                      <td>{row.frontierSpeedKmh} km/h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {model.accumulatedFigure ? (
          <PlotlyChart
            data={model.accumulatedFigure.data}
            layout={model.accumulatedFigure.layout}
            className="plot-card--hero"
          />
        ) : null}
      </div>
    </SectionCard>
  );
}
