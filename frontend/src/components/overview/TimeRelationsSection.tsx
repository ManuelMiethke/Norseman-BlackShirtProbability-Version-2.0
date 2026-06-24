import { useState } from "react";

import { PlotlyChart } from "@/components/common/PlotlyChart";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { buildTimeRelationFigures } from "@/lib/timeRelations";
import { useDashboard } from "@/state/DashboardContext";

export function TimeRelationsSection() {
  const { rows, selectedYear, selectedGroup, isLoading } = useDashboard();
  const [deltaOnly, setDeltaOnly] = useState(false);
  const cardClassName = "overview-card overview-card--split";

  if (isLoading) {
    return (
      <SectionCard title="Split Balance" className={cardClassName}>
        <StateBlock
          title="Loading"
          description="Preparing split balance."
        />
      </SectionCard>
    );
  }

  const { figures, note } = buildTimeRelationFigures(rows, selectedYear, selectedGroup, deltaOnly);

  return (
    <SectionCard title="Split Balance" className={cardClassName}>
      <div className="section-controls">
        <label className="toggle-pill">
          <input
            type="checkbox"
            checked={deltaOnly}
            onChange={(event) => setDeltaOnly(event.target.checked)}
          />
          <span>Delta vs Black</span>
        </label>
      </div>

      <div className="plot-grid plot-grid--2">
        {figures.map((figure) => (
          <PlotlyChart
            key={figure.key}
            data={figure.data}
            layout={figure.layout}
            className="plot-card--tall"
          />
        ))}
      </div>

      {note ? (
        <StateBlock
          title="DNF"
          description={note}
          tone="warning"
        />
      ) : null}
    </SectionCard>
  );
}
