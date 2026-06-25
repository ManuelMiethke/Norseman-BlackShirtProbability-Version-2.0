import { useState } from "react";

import { ChartInfoPopover } from "@/components/common/ChartInfoPopover";
import { PlotlyChart } from "@/components/common/PlotlyChart";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { TIME_RELATIONS_INFO } from "@/content/chartInfo";
import { buildTimeRelationFigures } from "@/lib/timeRelations";
import { useDashboard } from "@/state/DashboardContext";

export function TimeRelationsSection() {
  const { rows, selectedYear, selectedGroup, isLoading } = useDashboard();
  const [deltaOnly, setDeltaOnly] = useState(false);
  const cardClassName = "overview-card overview-card--split";
  const headerActions = <ChartInfoPopover title="Split Balance" info={TIME_RELATIONS_INFO} />;
  const footerControls = (
    <div className="section-controls section-controls--footer">
      <label className="toggle-pill">
        <input
          type="checkbox"
          checked={deltaOnly}
          onChange={(event) => setDeltaOnly(event.target.checked)}
        />
        <span>Delta vs Black</span>
      </label>
    </div>
  );

  if (isLoading) {
    return (
      <SectionCard
        title="Split Balance"
        className={cardClassName}
        headerActions={headerActions}
      >
        <StateBlock
          title="Loading"
          description="Preparing split balance."
        />
      </SectionCard>
    );
  }

  const { figures, note } = buildTimeRelationFigures(rows, selectedYear, selectedGroup, deltaOnly);

  return (
    <SectionCard
      title="Split Balance"
      className={cardClassName}
      headerActions={headerActions}
    >
      <div className="plot-grid plot-grid--2">
        {figures.map((figure) => (
          <PlotlyChart
            key={figure.key}
            data={figure.data}
            layout={figure.layout}
            className="plot-card--split-balance"
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

      {footerControls}
    </SectionCard>
  );
}
