import { ChartInfoPopover } from "@/components/common/ChartInfoPopover";
import type { ChartLegendItem } from "@/components/common/ChartLegend";
import { PlotlyChart } from "@/components/common/PlotlyChart";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { OUTCOME_MIX_INFO } from "@/content/chartInfo";
import { useLongData } from "@/hooks/useLongData";
import { PALETTE } from "@/lib/theme";
import { buildWhoAreWeRacingModel } from "@/lib/whoAreWeRacing";

const OUTCOME_LEGEND: ChartLegendItem[] = [
  { label: "Black Shirt", color: PALETTE.black },
  { label: "Missed (rank > 160)", color: "#ffffff", pattern: "hatched" },
  { label: "White (no cut-off)", color: PALETTE.white },
  { label: "DNF", color: PALETTE.dnf },
];

function formatHoursMinutes(hours: number) {
  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${wholeHours} h ${String(minutes).padStart(2, "0")} min`;
}

export function WhoAreWeRacingSection() {
  const { rows, isLoading, error } = useLongData();
  const cardClassName = "overview-card overview-card--outcomes";
  const headerActions = (
    <div className="section-toolbar">
      <ChartInfoPopover title="Outcome Mix" info={OUTCOME_MIX_INFO} />
    </div>
  );

  if (isLoading) {
    return (
      <SectionCard
        title="Outcome Mix"
        className={cardClassName}
        headerActions={headerActions}
      >
        <StateBlock
          title="Loading"
          description="Reading split history."
        />
      </SectionCard>
    );
  }

  if (error) {
    return (
      <SectionCard
        title="Outcome Mix"
        className={cardClassName}
        headerActions={headerActions}
      >
        <StateBlock
          title="Load failed"
          description={error}
          tone="error"
        />
      </SectionCard>
    );
  }

  const { outcomesFigure, frontierFigure, frontierMedianHours, warning } = buildWhoAreWeRacingModel(rows);

  return (
    <SectionCard
      title="Outcome Mix"
      className={cardClassName}
      headerActions={headerActions}
    >
      <div className="section-stack section-stack--fill">
        {warning ? (
          <StateBlock
            title="Note"
            description={warning}
            tone="warning"
          />
        ) : null}

        <div className="plot-grid plot-grid--stack plot-grid--fill">
          {outcomesFigure ? (
            <PlotlyChart
              data={outcomesFigure.data}
              layout={outcomesFigure.layout}
              className="plot-card--fill"
              title="Finishers per year"
              legend={OUTCOME_LEGEND}
            />
          ) : null}

          {frontierFigure ? (
            <PlotlyChart
              data={frontierFigure.data}
              layout={frontierFigure.layout}
              className="plot-card--fill"
              title="Time of rank ~160 at the cut-off"
              headerExtra={
                frontierMedianHours !== null ? (
                  <>
                    Median <strong>{formatHoursMinutes(frontierMedianHours)}</strong>
                  </>
                ) : null
              }
            />
          ) : null}
        </div>
      </div>
    </SectionCard>
  );
}
