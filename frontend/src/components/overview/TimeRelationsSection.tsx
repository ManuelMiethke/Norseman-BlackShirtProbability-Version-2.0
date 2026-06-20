import { useState } from "react";

import { PlotlyChart } from "@/components/common/PlotlyChart";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { buildTimeRelationFigures } from "@/lib/timeRelations";
import { useDashboard } from "@/state/DashboardContext";

export function TimeRelationsSection() {
  const { rows, selectedYear, selectedGroup, isLoading } = useDashboard();
  const [deltaOnly, setDeltaOnly] = useState(false);

  if (isLoading) {
    return (
      <SectionCard
        title="Distance vs. Time Relations"
        description="This is the first Plotly chart block ported from Streamlit to React."
      >
        <StateBlock
          title="Loading chart data"
          description="Preparing group-level time-share donuts from the shared wide dataset."
        />
      </SectionCard>
    );
  }

  const { figures, note } = buildTimeRelationFigures(rows, selectedYear, selectedGroup, deltaOnly);

  return (
    <SectionCard
      title="Distance vs. Time Relations"
      description="The donut charts keep the original Plotly structure: race distance share, plus median segment time share for Top 10, Black Shirt and White Shirt groups."
    >
      <div className="section-controls">
        <label className="toggle-pill">
          <input
            type="checkbox"
            checked={deltaOnly}
            onChange={(event) => setDeltaOnly(event.target.checked)}
          />
          <span>Show Δ compared to Black Shirts</span>
        </label>
      </div>

      <div className={`plot-grid plot-grid--${Math.min(figures.length, 4)}`}>
        {figures.map((figure) => (
          <PlotlyChart
            key={figure.key}
            data={figure.data}
            layout={figure.layout}
          />
        ))}
      </div>

      {note ? (
        <StateBlock
          title="DNF note"
          description={note}
          tone="warning"
        />
      ) : null}
    </SectionCard>
  );
}
