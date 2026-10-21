import { useState } from "react";

import { ChartInfoPopover } from "@/components/common/ChartInfoPopover";
import type { ChartLegendItem } from "@/components/common/ChartLegend";
import { PlotlyChart } from "@/components/common/PlotlyChart";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { EMPIRICAL_PACE_INFO } from "@/content/chartInfo";
import { useCourseProfileData } from "@/hooks/useCourseProfileData";
import { useLongData } from "@/hooks/useLongData";
import {
  buildEmpiricalDetailChart,
  buildEmpiricalPlanModel,
  EMPIRICAL_PREF_OPTIONS,
  TRAINING_LABELS_SHORT,
  type EmpiricalPref,
} from "@/lib/empiricalPace";
import { PALETTE } from "@/lib/theme";
import { useDashboard } from "@/state/DashboardContext";

const PLANNER_LEGEND: ChartLegendItem[] = [
  { label: "Recommended speed (km/h)", color: PALETTE.accent, shape: "line" },
  { label: "Course elevation", color: PALETTE.elevationLine },
];

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
  const headerActions = <ChartInfoPopover title="Pace Planner" info={EMPIRICAL_PACE_INFO} />;
  const footerControls = (
    <div className="section-controls section-controls--footer">
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
  );

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

  const disciplines: Array<{
    key: "swim" | "bike" | "run";
    label: string;
    expertLabel: string;
    value: EmpiricalPref;
    onChange: (pref: EmpiricalPref) => void;
    labels: Record<EmpiricalPref, string>;
  }> = [
    {
      key: "swim",
      label: "Swim training",
      expertLabel: "Swim (CSS)",
      value: swimPref,
      onChange: setSwimPref,
      labels: model.swimExpertLabels,
    },
    {
      key: "bike",
      label: "Bike training",
      expertLabel: "Bike (FTP W/kg)",
      value: bikePref,
      onChange: setBikePref,
      labels: model.bikeExpertLabels,
    },
    {
      key: "run",
      label: "Run training",
      expertLabel: "Run (road marathon)",
      value: runPref,
      onChange: setRunPref,
      labels: model.runExpertLabels,
    },
  ];
  const legTiles = [
    { label: "Swim", time: model.overview.swimTime, pace: model.overview.swimPace },
    { label: "T1", time: model.overview.t1Time, pace: null },
    { label: "Bike", time: model.overview.bikeTime, pace: model.overview.bikePace },
    { label: "T2", time: model.overview.t2Time, pace: null },
    { label: "Run", time: model.overview.runTime, pace: model.overview.runPace },
  ];

  return (
    <SectionCard title="Pace Planner" headerActions={headerActions}>
      <div className="section-stack">
        <div className="tool-panel">
          <p className="tool-panel__intro">
            How much do you train in each discipline? Pick a level and the planner splits a Black Shirt
            target time across the legs based on historical Black Shirt finishers.
          </p>

          <div className="tool-choice-list">
            {disciplines.map((discipline) => (
              <div key={discipline.key} className="tool-choice">
                <span className="tool-choice__label">
                  {expertMode ? discipline.expertLabel : discipline.label}
                </span>
                <div
                  className="segmented-control segmented-control--stretch"
                  role="radiogroup"
                  aria-label={expertMode ? discipline.expertLabel : discipline.label}
                >
                  {EMPIRICAL_PREF_OPTIONS.map((pref) => (
                    <button
                      key={pref}
                      type="button"
                      role="radio"
                      aria-checked={discipline.value === pref}
                      className={
                        discipline.value === pref
                          ? "segmented-control__button segmented-control__button--active"
                          : "segmented-control__button"
                      }
                      onClick={() => discipline.onChange(pref)}
                    >
                      {preferenceLabel(pref, expertMode, discipline.labels)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="plan-tiles">
          {legTiles.map((tile) => (
            <article key={tile.label} className="plan-tile">
              <span>{tile.label}</span>
              <strong>{tile.time}</strong>
              {tile.pace ? <em>{tile.pace}</em> : null}
            </article>
          ))}
          <article className="plan-tile plan-tile--feature">
            <span>At 37.5 km run</span>
            <strong>{model.overview.timeAtDecision}</strong>
            <em>Black Shirt decision</em>
          </article>
        </div>

        <p className="tool-caption">{model.caption}</p>

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
              className="plot-card--focus"
              title="Recommended speed per segment"
              legend={PLANNER_LEGEND}
            />
          ) : null}

        {footerControls}
      </div>
    </SectionCard>
  );
}
