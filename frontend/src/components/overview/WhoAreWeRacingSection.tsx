import { ChartInfoPopover } from "@/components/common/ChartInfoPopover";
import { PlotlyChart } from "@/components/common/PlotlyChart";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { OUTCOME_MIX_INFO } from "@/content/chartInfo";
import { useLongData } from "@/hooks/useLongData";
import { buildWhoAreWeRacingModel } from "@/lib/whoAreWeRacing";

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
      <div className="section-stack">
        {warning ? (
          <StateBlock
            title="Note"
            description={warning}
            tone="warning"
          />
        ) : null}

        <div className="plot-grid plot-grid--stack">
          {outcomesFigure ? (
            <PlotlyChart
              data={outcomesFigure.data}
              layout={outcomesFigure.layout}
              className="plot-card--tall"
            />
          ) : null}

          {frontierFigure ? (
            <PlotlyChart
              data={frontierFigure.data}
              layout={frontierFigure.layout}
              className="plot-card--tall"
            />
          ) : null}
        </div>

        {frontierMedianHours !== null ? (
          <div className="section-note">
            <strong>Cut-off median</strong>
            <span>
              2024-2025 median at 37.5 km: {frontierMedianHours.toFixed(2)} h
            </span>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
