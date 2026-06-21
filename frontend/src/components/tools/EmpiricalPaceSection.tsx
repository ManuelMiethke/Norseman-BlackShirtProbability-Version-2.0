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
    <SectionCard
      title="13:51 Black Shirt Empirical Pacing"
      description="This React section ports the original empirical pacing tool end to end: a Black-Shirt-derived leg distribution, interactive discipline preferences, the overview table and the detailed course/speed figure."
    >
      <div className="section-stack">
        <div className="section-note">
          <strong>Scope</strong>
          <span>
            The empirical blueprint is always based on Black-Shirt medians from the
            37.5 km cut-off years 2024 and 2025. If the global year filter is set to
            2024 or 2025, the detail figure narrows its empirical median to that year;
            otherwise it keeps the combined two-year baseline, matching Streamlit.
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

        <div className="table-panel">
          <div className="table-panel__header">
            <div>
              <h4>Detailed pacing profile</h4>
              <p>
                Course elevation stays in the background while the orange step line
                shows the recommended speed blueprint to the 37.5 km Black-Shirt
                decision point.
              </p>
            </div>
          </div>

          {longData.isLoading || courseProfileData.isLoading ? (
            <StateBlock
              title="Loading pacing profile"
              description="Preparing split medians from the long race data and the packaged course profile."
            />
          ) : null}

          {longData.error ? (
            <StateBlock
              title="Long-data load failed"
              description={longData.error}
              tone="error"
            />
          ) : null}

          {courseProfileData.error ? (
            <StateBlock
              title="Course-profile load failed"
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
              title="No pacing profile available"
              description="The packaged split or course datasets are empty after validation, so the empirical detail figure cannot be rendered."
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
      </div>
    </SectionCard>
  );
}
