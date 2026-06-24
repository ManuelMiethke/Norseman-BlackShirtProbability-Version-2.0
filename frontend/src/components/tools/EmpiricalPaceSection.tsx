import { useState } from "react";

import { PlotlyChart } from "@/components/common/PlotlyChart";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { useCourseProfileData } from "@/hooks/useCourseProfileData";
import { useLongData } from "@/hooks/useLongData";
import {
  buildEmpiricalDetailChart,
  buildEmpiricalPlanModel,
  EMPIRICAL_PREF_OPTIONS,
  TRAINING_LABELS_SHORT,
  type EmpiricalPref,
} from "@/lib/empiricalPace";
import { useDashboard } from "@/state/DashboardContext";

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
  const longData = useLongData();
  const courseProfileData = useCourseProfileData();
  const { selectedYear } = useDashboard();
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
  const detailChart =
    !longData.isLoading &&
    !courseProfileData.isLoading &&
    !longData.error &&
    !courseProfileData.error &&
    longData.rows.length > 0 &&
    courseProfileData.rows.length > 0
      ? buildEmpiricalDetailChart(
          longData.rows,
          courseProfileData.rows,
          model.legTimes,
          selectedYear,
        )
      : null;

  return (
    <SectionCard title="Pace Planner">
      <div className="section-stack">
        <div className="section-controls">
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
            <span>Explore mode</span>
          </label>

          {exploreMode ? (
            <label className="toggle-pill">
              <input
                type="checkbox"
                checked={expertMode}
                onChange={(event) => setExpertMode(event.target.checked)}
              />
              <span>Expert mode</span>
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
          <strong>Plan</strong>
          <span>{model.caption}</span>
        </div>

        <details className="disclosure-panel">
          <summary>
            <span>Plan details</span>
            <span className="disclosure-panel__chevron">⌄</span>
          </summary>

          <div className="disclosure-panel__body">
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
        </details>

        {longData.isLoading || courseProfileData.isLoading ? (
          <StateBlock
            title="Loading"
            description="Preparing pacing profile."
          />
        ) : null}

        {longData.error ? (
          <StateBlock
            title="Long-data failed"
            description={longData.error}
            tone="error"
          />
        ) : null}

        {courseProfileData.error ? (
          <StateBlock
            title="Course failed"
            description={courseProfileData.error}
            tone="error"
          />
        ) : null}

        {!longData.isLoading &&
          !courseProfileData.isLoading &&
          !longData.error &&
          !courseProfileData.error &&
          !detailChart ? (
            <StateBlock
              title="No data"
              description="No pacing profile available."
              tone="warning"
            />
          ) : null}

        {!longData.isLoading &&
          !courseProfileData.isLoading &&
          !longData.error &&
          !courseProfileData.error &&
          detailChart ? (
            <PlotlyChart
              data={detailChart.data}
              layout={detailChart.layout}
              className="plot-card--xl"
            />
          ) : null}
      </div>
    </SectionCard>
  );
}
