import { useState } from "react";

import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import {
  buildEmpiricalPlanModel,
  EMPIRICAL_PREF_OPTIONS,
  TRAINING_LABELS_SHORT,
  type EmpiricalPref,
} from "@/lib/empiricalPace";

function preferenceLabel(
  pref: EmpiricalPref,
  expertMode: boolean,
  labels: Record<EmpiricalPref, string>,
) {
  if (expertMode) {
    return labels[pref];
  }
  return TRAINING_LABELS_SHORT[pref];
}

export function EmpiricalPaceSection() {
  const [exploreMode, setExploreMode] = useState(false);
  const [expertMode, setExpertMode] = useState(false);
  const [swimPref, setSwimPref] = useState<EmpiricalPref>("p50");
  const [bikePref, setBikePref] = useState<EmpiricalPref>("p50");
  const [runPref, setRunPref] = useState<EmpiricalPref>("p50");

  const model = buildEmpiricalPlanModel({
    swimPref,
    bikePref,
    runPref,
    exploreMode,
  });

  return (
    <SectionCard
      title="13:51 Black Shirt Empirical Pacing"
      description="This React section ports the planning core of the original empirical pacing tool: a Black-Shirt-derived leg distribution, interactive discipline preferences and the resulting target overview table."
    >
      <div className="section-stack">
        <div className="section-note">
          <strong>Current scope</strong>
          <span>
            This slice preserves the planner logic and overview table first. The
            detailed course-elevation and recommended-speed figure stays queued as the
            final part of the original Streamlit module.
          </span>
        </div>

        <div className="section-controls section-controls--stacked">
          <label className="toggle-pill">
            <input
              type="checkbox"
              checked={exploreMode}
              onChange={(event) => {
                const checked = event.target.checked;
                setExploreMode(checked);
                if (!checked) {
                  setExpertMode(false);
                }
              }}
            />
            <span>Explore mode (unlock total time)</span>
          </label>

          {exploreMode ? (
            <label className="toggle-pill">
              <input
                type="checkbox"
                checked={expertMode}
                onChange={(event) => setExpertMode(event.target.checked)}
              />
              <span>Expert mode (performance labels)</span>
            </label>
          ) : null}
        </div>

        <div className="tool-grid">
          <label className="tool-field">
            <span>{expertMode ? "Swim (CSS)" : "Swim Training Time"}</span>
            <select
              value={swimPref}
              onChange={(event) => setSwimPref(event.target.value as EmpiricalPref)}
            >
              {EMPIRICAL_PREF_OPTIONS.map((pref) => (
                <option key={pref} value={pref}>
                  {preferenceLabel(pref, expertMode, model.swimExpertLabels)}
                </option>
              ))}
            </select>
          </label>

          <label className="tool-field">
            <span>{expertMode ? "Bike (FTP W/kg)" : "Bike Training Time"}</span>
            <select
              value={bikePref}
              onChange={(event) => setBikePref(event.target.value as EmpiricalPref)}
            >
              {EMPIRICAL_PREF_OPTIONS.map((pref) => (
                <option key={pref} value={pref}>
                  {preferenceLabel(pref, expertMode, model.bikeExpertLabels)}
                </option>
              ))}
            </select>
          </label>

          <label className="tool-field">
            <span>{expertMode ? "Run (Road Marathon Time)" : "Run Training Time"}</span>
            <select
              value={runPref}
              onChange={(event) => setRunPref(event.target.value as EmpiricalPref)}
            >
              {EMPIRICAL_PREF_OPTIONS.map((pref) => (
                <option key={pref} value={pref}>
                  {preferenceLabel(pref, expertMode, model.runExpertLabels)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="section-note">
          <strong>Plan summary</strong>
          <span>{model.caption}</span>
        </div>

        <div className="table-panel">
          <div className="table-panel__header">
            <div>
              <h4>Leg distribution overview</h4>
              <p>
                The values below update immediately as the discipline preferences shift.
              </p>
            </div>
          </div>

          <div className="table-scroll">
            <table className="data-table empirical-table">
              <thead>
                <tr>
                  <th>Swim Time</th>
                  <th>Swim Pace</th>
                  <th>T1 Time</th>
                  <th>Bike Time</th>
                  <th>Bike Pace</th>
                  <th>T2 Time</th>
                  <th>Run Time</th>
                  <th>Run Pace</th>
                  <th>Time at 37.5 km run</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{model.overview.swimTime}</td>
                  <td>{model.overview.swimPace}</td>
                  <td>{model.overview.t1Time}</td>
                  <td>{model.overview.bikeTime}</td>
                  <td>{model.overview.bikePace}</td>
                  <td>{model.overview.t2Time}</td>
                  <td>{model.overview.runTime}</td>
                  <td>{model.overview.runPace}</td>
                  <td>{model.overview.timeAtDecision}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <StateBlock
          title="Remaining empirical pace slice"
          description="The detailed course profile plus recommended-speed figure is still pending. The planner logic and overview table are now React-native, which reduces the remaining work to the visualization layer."
        />
      </div>
    </SectionCard>
  );
}
