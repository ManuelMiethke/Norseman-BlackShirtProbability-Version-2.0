import { useState } from "react";

import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { useModelData } from "@/hooks/useModelData";
import {
  computeCatchup,
  computeEmpiricalParameters,
  formatPaceMinPerKm,
  formatSpeedKmh,
  prepareCatchupRows,
} from "@/lib/catchup";
import { useDashboard } from "@/state/DashboardContext";

function percentageLabel(value: number | null) {
  return value === null || Number.isNaN(value) ? "–" : `${(value * 100).toFixed(1)} %`;
}

export function CatchupSection() {
  const modelData = useModelData();
  const { selectedYear } = useDashboard();
  const [bikeKm, setBikeKm] = useState("");
  const [runKm, setRunKm] = useState("");
  const [raceTime, setRaceTime] = useState("");

  if (modelData.isLoading) {
    return (
      <SectionCard title="Odds">
        <StateBlock
          title="Loading"
          description="Preparing estimator."
        />
      </SectionCard>
    );
  }

  if (modelData.error) {
    return (
      <SectionCard title="Odds">
        <StateBlock
          title="Load failed"
          description={modelData.error}
          tone="error"
        />
      </SectionCard>
    );
  }

  const rows = prepareCatchupRows(modelData.rows, selectedYear);
  if (rows.length === 0) {
    return (
      <SectionCard title="Odds">
        <StateBlock
          title="No data"
          description="No model data for this year."
          tone="warning"
        />
      </SectionCard>
    );
  }

  const empirical = computeEmpiricalParameters(rows);
  const result = computeCatchup(rows, empirical, bikeKm, runKm, raceTime);

  return (
    <SectionCard title="Odds">
      <div className="section-stack">
        <div className="tool-grid">
          <label className="tool-field">
            <span>Bike km</span>
            <input
              type="text"
              value={bikeKm}
              onChange={(event) => setBikeKm(event.target.value)}
              placeholder="e.g. 50"
            />
          </label>

          <label className="tool-field">
            <span>Run km</span>
            <input
              type="text"
              value={runKm}
              onChange={(event) => setRunKm(event.target.value)}
              placeholder="e.g. 5"
            />
          </label>

          <label className="tool-field tool-field--wide">
            <span>Race time at this point (hh:mm)</span>
            <input
              type="text"
              value={raceTime}
              onChange={(event) => setRaceTime(event.target.value)}
              placeholder="hh:mm"
            />
          </label>
        </div>

        {result.kmError ? (
          <StateBlock title="Distance error" description={result.kmError} tone="error" />
        ) : null}

        {result.timeError ? (
          <StateBlock title="Time error" description={result.timeError} tone="error" />
        ) : null}

        <div className="kpi-grid">
          <article className="metric-card">
            <div className="metric-card__header">
              <h4>Black Shirt probability</h4>
              <span>Model</span>
            </div>
            <strong className="tool-metric">{percentageLabel(result.probabilityModel)}</strong>
          </article>

          <article className="metric-card">
            <div className="metric-card__header">
              <h4>Similar athletes</h4>
              <span>{result.sampleSize > 0 ? `n = ${result.sampleSize}` : "Historical share"}</span>
            </div>
            <strong className="tool-metric">{percentageLabel(result.probabilityEmpirical)}</strong>
          </article>

          <article className="metric-card">
            <div className="metric-card__header">
              <h4>Required bike pace</h4>
              <span>Until Stavsro</span>
            </div>
            <strong className="tool-metric">{formatSpeedKmh(result.bikeSpeedRequired)}</strong>
          </article>

          <article className="metric-card">
            <div className="metric-card__header">
              <h4>Required run pace</h4>
              <span>Until Stavsro</span>
            </div>
            <strong className="tool-metric">{formatPaceMinPerKm(result.runPaceRequired)}</strong>
          </article>
        </div>

        {result.leg === "pre_swim" ? (
          <StateBlock
            title="Too early"
            description="Catch Up is intended for use after the swim, so the distance after swim must be 0 km or greater."
            tone="warning"
          />
        ) : null}

        {result.leg === "beyond" ? (
          <StateBlock
            title="Beyond Stavsro"
            description="The entered distance is already beyond the Stavsro cut-off point at 217.5 km after the swim."
            tone="warning"
          />
        ) : null}

        {result.leg !== null && (result.infeasible || result.runTooFast) ? (
          <StateBlock
            title="Theoretical target"
            description={
              result.leg === "run" || result.runTooFast
                ? "To reach the target time, the required run pace is extremely fast (faster than 5:30 min/km). Treat it mainly as a theoretical threshold."
                : "To reach the target time, both bike and run would need to be much faster than typical Black-Shirt performances. Treat the required paces mainly as theoretical values."
            }
            tone="warning"
          />
        ) : null}
      </div>
    </SectionCard>
  );
}
