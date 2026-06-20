import { useState } from "react";

import { PlotlyChart } from "@/components/common/PlotlyChart";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { useLongData } from "@/hooks/useLongData";
import { buildRankProgressionModel } from "@/lib/rankProgression";
import { useDashboard } from "@/state/DashboardContext";

const MODE_OPTIONS = ["Top 10 finishers", "All athletes to cut-off"] as const;

export function RankProgressionSection() {
  const { rows, isLoading, error } = useLongData();
  const { selectedYear, selectedGroup } = useDashboard();
  const [mode, setMode] = useState<(typeof MODE_OPTIONS)[number]>("Top 10 finishers");
  const [focusTop10, setFocusTop10] = useState(true);

  if (isLoading) {
    return (
      <SectionCard
        title="Rank Progression"
        description="This React section follows athlete positions over the course using the packaged long split dataset."
      >
        <StateBlock
          title="Loading rank history"
          description="Preparing split-by-split athlete positions for the selected year."
        />
      </SectionCard>
    );
  }

  if (error) {
    return (
      <SectionCard
        title="Rank Progression"
        description="This React section follows athlete positions over the course using the packaged long split dataset."
      >
        <StateBlock
          title="Split dataset load failed"
          description={error}
          tone="error"
        />
      </SectionCard>
    );
  }

  const { figure, warning, description } = buildRankProgressionModel(
    rows,
    selectedYear,
    selectedGroup,
    mode,
    focusTop10,
  );

  return (
    <SectionCard
      title="Rank Progression"
      description="This combines the original Top 10 and all-athlete race-position charts into one React section while preserving the underlying rank-by-distance logic."
    >
      <div className="section-stack">
        <div className="section-controls section-controls--stacked">
          <div className="segmented-control" role="tablist" aria-label="Rank progression mode">
            {MODE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={
                  option === mode
                    ? "segmented-control__button segmented-control__button--active"
                    : "segmented-control__button"
                }
                onClick={() => setMode(option)}
              >
                {option}
              </button>
            ))}
          </div>

          {mode === "Top 10 finishers" ? (
            <label className="toggle-pill">
              <input
                type="checkbox"
                checked={focusTop10}
                onChange={(event) => setFocusTop10(event.target.checked)}
              />
              <span>Focus on Top 10 places only</span>
            </label>
          ) : null}
        </div>

        <div className="section-note">
          <strong>Race-position context</strong>
          <span>{description}</span>
        </div>

        {warning ? (
          <StateBlock
            title="Rank progression unavailable"
            description={warning}
            tone="warning"
          />
        ) : null}

        {figure ? (
          <PlotlyChart
            data={figure.data}
            layout={figure.layout}
            className="plot-card--xl"
          />
        ) : null}
      </div>
    </SectionCard>
  );
}
