import { useState } from "react";

import { ChartInfoPopover } from "@/components/common/ChartInfoPopover";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { CATCHUP_INFO } from "@/content/chartInfo";
import { useModelData } from "@/hooks/useModelData";
import {
  computeCatchup,
  computeEmpiricalParameters,
  formatPaceMinPerKm,
  formatSpeedKmh,
  prepareCatchupRows,
} from "@/lib/catchup";
import { useDashboard } from "@/state/DashboardContext";

type Leg = "bike" | "run";

const LEG_LIMITS: Record<Leg, { max: number; placeholder: string; hint: string }> = {
  bike: { max: 180, placeholder: "50", hint: "0 – 180 km on the bike" },
  run: { max: 37, placeholder: "5", hint: "0 – 37 km on the run" },
};

function percentageLabel(value: number | null) {
  return value === null || Number.isNaN(value) ? "–" : `${(value * 100).toFixed(1)} %`;
}

function clampPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value * 100));
}

export function CatchupSection() {
  const modelData = useModelData();
  const { selectedYear } = useDashboard();
  const [leg, setLeg] = useState<Leg>("bike");
  const [km, setKm] = useState("");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const headerActions = (
    <div className="section-toolbar">
      <ChartInfoPopover title="Odds" info={CATCHUP_INFO} />
    </div>
  );

  if (modelData.isLoading) {
    return (
      <SectionCard title="Odds" headerActions={headerActions}>
        <StateBlock
          title="Loading"
          description="Preparing estimator."
        />
      </SectionCard>
    );
  }

  if (modelData.error) {
    return (
      <SectionCard title="Odds" headerActions={headerActions}>
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
      <SectionCard title="Odds" headerActions={headerActions}>
        <StateBlock
          title="No data"
          description="No model data for this year."
          tone="warning"
        />
      </SectionCard>
    );
  }

  // The estimator expects "hh:mm"; the form collects hours and minutes separately.
  const raceTime =
    hours.trim() || minutes.trim()
      ? `${hours.trim() || "0"}:${(minutes.trim() || "0").padStart(2, "0")}`
      : "";
  const empirical = computeEmpiricalParameters(rows);
  const result = computeCatchup(
    rows,
    empirical,
    leg === "bike" ? km : "",
    leg === "run" ? km : "",
    raceTime,
  );
  const hasInput = km.trim() !== "" && raceTime !== "";
  const probability = clampPercent(result.probabilityModel);

  return (
    <SectionCard title="Odds" headerActions={headerActions}>
      <div className="section-stack">
        <div className="tool-panel">
          <p className="tool-panel__intro">
            Where are you in the race? Enter your position and elapsed race time to see your Black Shirt
            odds and the pace you need until the Stavsro cut-off.
          </p>

          <div className="tool-form">
            <div className="tool-field">
              <span>Leg</span>
              <div className="segmented-control segmented-control--compact" role="tablist" aria-label="Current leg">
                {(["bike", "run"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={
                      leg === option
                        ? "segmented-control__button segmented-control__button--active"
                        : "segmented-control__button"
                    }
                    onClick={() => setLeg(option)}
                  >
                    {option === "bike" ? "Bike" : "Run"}
                  </button>
                ))}
              </div>
            </div>

            <label className="tool-field">
              <span>Distance on this leg</span>
              <div className="tool-input">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={LEG_LIMITS[leg].max}
                  step={1}
                  value={km}
                  onChange={(event) => setKm(event.target.value)}
                  placeholder={LEG_LIMITS[leg].placeholder}
                />
                <em>km</em>
              </div>
              <small>{LEG_LIMITS[leg].hint}</small>
            </label>

            <div className="tool-field">
              <span>Race time so far</span>
              <div className="tool-time">
                <div className="tool-input">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={23}
                    step={1}
                    value={hours}
                    onChange={(event) => setHours(event.target.value)}
                    placeholder="9"
                    aria-label="Hours"
                  />
                  <em>h</em>
                </div>
                <div className="tool-input">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={59}
                    step={1}
                    value={minutes}
                    onChange={(event) => setMinutes(event.target.value)}
                    placeholder="30"
                    aria-label="Minutes"
                  />
                  <em>min</em>
                </div>
              </div>
              <small>Since the swim start</small>
            </div>
          </div>
        </div>

        {result.kmError ? (
          <StateBlock title="Distance" description={result.kmError} tone="error" />
        ) : null}

        {result.timeError ? (
          <StateBlock title="Race time" description={result.timeError} tone="error" />
        ) : null}

        <div className="tool-results">
          <article className="metric-card tool-result tool-result--feature">
            <div className="metric-card__header">
              <h4>Black Shirt probability</h4>
              <span>Model</span>
            </div>
            <strong className="tool-metric">{percentageLabel(result.probabilityModel)}</strong>
            <div className="tool-meter" aria-hidden="true">
              <div className="tool-meter__fill" style={{ width: `${probability}%` }} />
            </div>
            {!hasInput ? <p className="tool-result__hint">Fill in distance and race time above.</p> : null}
          </article>

          <article className="metric-card tool-result">
            <div className="metric-card__header">
              <h4>Similar athletes</h4>
              <span>{result.sampleSize > 0 ? `n = ${result.sampleSize}` : "Historical share"}</span>
            </div>
            <strong className="tool-metric">{percentageLabel(result.probabilityEmpirical)}</strong>
          </article>

          <article className="metric-card tool-result">
            <div className="metric-card__header">
              <h4>Required bike speed</h4>
              <span>Until Stavsro</span>
            </div>
            <strong className="tool-metric">{formatSpeedKmh(result.bikeSpeedRequired)}</strong>
          </article>

          <article className="metric-card tool-result">
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
