import { useDeferredValue, useState } from "react";

import { ChartInfoPopover } from "@/components/common/ChartInfoPopover";
import { PlotlyChart } from "@/components/common/PlotlyChart";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { PROBABILITY_SURFACE_INFO } from "@/content/chartInfo";
import { useModelData } from "@/hooks/useModelData";
import {
  buildProbabilityMarkers,
  buildProbabilitySurfaceModel,
  parseHhMmToHours,
  parseOptionalKm,
} from "@/lib/probability3d";
import { useDashboard } from "@/state/DashboardContext";

export function Probability3DSection() {
  const modelData = useModelData();
  const { selectedYear, selectedGroup } = useDashboard();
  const [mode, setMode] = useState<"3d" | "2d">("3d");
  const [bikeKmText, setBikeKmText] = useState("");
  const [runKmText, setRunKmText] = useState("");
  const [timeText, setTimeText] = useState("");
  const headerActions = <ChartInfoPopover title="Probability Surface" info={PROBABILITY_SURFACE_INFO} />;
  const footerControls = (
    <div className="section-controls section-controls--footer">
      <div className="segmented-control" role="tablist" aria-label="Probability surface mode">
        <button
          type="button"
          className={mode === "3d" ? "segmented-control__button segmented-control__button--active" : "segmented-control__button"}
          onClick={() => setMode("3d")}
        >
          3D surface
        </button>
        <button
          type="button"
          className={mode === "2d" ? "segmented-control__button segmented-control__button--active" : "segmented-control__button"}
          onClick={() => setMode("2d")}
        >
          2D transition
        </button>
      </div>
    </div>
  );

  const deferredBikeKmText = useDeferredValue(bikeKmText);
  const deferredRunKmText = useDeferredValue(runKmText);
  const deferredTimeText = useDeferredValue(timeText);

  if (modelData.isLoading) {
    return (
      <SectionCard title="Probability Surface" headerActions={headerActions}>
        <StateBlock title="Loading" description="Preparing probability surface." />
      </SectionCard>
    );
  }

  if (modelData.error) {
    return (
      <SectionCard title="Probability Surface" headerActions={headerActions}>
        <StateBlock title="Load failed" description={modelData.error} tone="error" />
      </SectionCard>
    );
  }

  const bikeKm = parseOptionalKm(deferredBikeKmText, 180);
  const runKm = parseOptionalKm(deferredRunKmText, 42.2);
  const hasAnyLegInput = deferredBikeKmText.trim().length > 0 || deferredRunKmText.trim().length > 0;
  const timeHours = parseHhMmToHours(deferredTimeText);
  const markers = timeHours !== null ? buildProbabilityMarkers(bikeKm, runKm) : [];

  const model = buildProbabilitySurfaceModel(
    modelData.rows,
    selectedYear,
    selectedGroup,
    mode,
    markers,
    timeHours,
  );

  return (
    <SectionCard title="Probability Surface" headerActions={headerActions}>
      <div className="section-stack">
        <div className="tool-grid">
          <label className="tool-field">
            <span>Bike km</span>
            <input
              value={bikeKmText}
              onChange={(event) => setBikeKmText(event.target.value)}
              placeholder="e.g. 47"
            />
          </label>
          <label className="tool-field">
            <span>Run km</span>
            <input
              value={runKmText}
              onChange={(event) => setRunKmText(event.target.value)}
              placeholder="e.g. 10"
            />
          </label>
          <label className="tool-field">
            <span>Time (hh:mm)</span>
            <input
              value={timeText}
              onChange={(event) => setTimeText(event.target.value)}
              placeholder="e.g. 10:30"
            />
          </label>
        </div>

        {deferredBikeKmText.trim().length > 0 && bikeKm === null ? (
          <StateBlock title="Bike input" description="Bike km must be between 0 and 180." tone="warning" />
        ) : null}
        {deferredRunKmText.trim().length > 0 && runKm === null ? (
          <StateBlock title="Run input" description="Run km must be between 0 and 42.2." tone="warning" />
        ) : null}
        {hasAnyLegInput && deferredTimeText.trim().length > 0 && timeHours === null ? (
          <StateBlock title="Time input" description="Please use time format hh:mm." tone="warning" />
        ) : null}
        {model.warning ? <StateBlock title="Note" description={model.warning} tone="warning" /> : null}

        {model.figure ? (
          <PlotlyChart
            data={model.figure.data}
            layout={model.figure.layout}
            className="plot-card--3d"
          />
        ) : null}

        {model.markerSummaries.length > 0 ? (
          <div className="section-note">
            <strong>Position checks</strong>
            <span>{model.markerSummaries.join(" | ")}</span>
          </div>
        ) : null}

        {footerControls}
      </div>
    </SectionCard>
  );
}
