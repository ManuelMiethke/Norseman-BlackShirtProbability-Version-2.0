import { useState } from "react";

import { PlotlyChart } from "@/components/common/PlotlyChart";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { useLongData } from "@/hooks/useLongData";
import { buildRankProgressionModel } from "@/lib/rankProgression";
import { useDashboard } from "@/state/DashboardContext";

const MODE_OPTIONS = ["Top 10 finishers", "Places 140-180", "All athletes to cut-off"] as const;

export function RankProgressionSection() {
  const { rows, isLoading, error } = useLongData();
  const { selectedYear, selectedGroup } = useDashboard();
  const [mode, setMode] = useState<(typeof MODE_OPTIONS)[number]>("Top 10 finishers");
  const [focusTop10, setFocusTop10] = useState(true);
  const cardClassName = "overview-card overview-card--rank";

  if (isLoading) {
    return (
      <SectionCard title="Rank Progression" className={cardClassName}>
        <StateBlock
          title="Loading"
          description="Preparing rank history."
        />
      </SectionCard>
    );
  }

  if (error) {
    return (
      <SectionCard title="Rank Progression" className={cardClassName}>
        <StateBlock
          title="Load failed"
          description={error}
          tone="error"
        />
      </SectionCard>
    );
  }

  const { figure, warning } = buildRankProgressionModel(
    rows,
    selectedYear,
    selectedGroup,
    mode,
    focusTop10,
  );

  return (
    <SectionCard title="Rank Progression" className={cardClassName}>
      <div className="section-stack">
        <div className="section-controls">
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
              <span>Top 10 only</span>
            </label>
          ) : null}
        </div>

        {warning ? (
          <StateBlock
            title="Note"
            description={warning}
            tone="warning"
          />
        ) : null}

        {figure ? (
          <PlotlyChart
            data={figure.data}
            layout={figure.layout}
            className="plot-card--focus"
          />
        ) : null}
      </div>
    </SectionCard>
  );
}
