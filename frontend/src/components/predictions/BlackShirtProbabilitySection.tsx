import { PlotlyChart } from "@/components/common/PlotlyChart";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { useModelData } from "@/hooks/useModelData";
import { buildBlackShirtProbabilityModel } from "@/lib/blackShirtProbability";
import { useDashboard } from "@/state/DashboardContext";

export function BlackShirtProbabilitySection() {
  const modelData = useModelData();
  const { selectedYear, selectedGroup } = useDashboard();

  if (modelData.isLoading) {
    return (
      <SectionCard
        title="Black Shirt Probability"
        description="This React section preserves the original probability trajectories for Black-Shirt success across the course."
      >
        <StateBlock
          title="Loading probability trajectories"
          description="Preparing athlete-level Black-Shirt probabilities from the packaged model test set."
        />
      </SectionCard>
    );
  }

  if (modelData.error) {
    return (
      <SectionCard
        title="Black Shirt Probability"
        description="This React section preserves the original probability trajectories for Black-Shirt success across the course."
      >
        <StateBlock
          title="Probability data load failed"
          description={modelData.error}
          tone="error"
        />
      </SectionCard>
    );
  }

  const model = buildBlackShirtProbabilityModel(
    modelData.rows,
    selectedYear,
    selectedGroup,
  );

  return (
    <SectionCard
      title="Black Shirt Probability over the Norseman Course"
      description="Thin traces show individual athletes, while dashed and dotted overlays preserve the original median and mean probability trajectories for each displayed finisher group."
    >
      <div className="section-stack">
        <div className="section-note">
          <strong>Group semantics</strong>
          <span>
            In multi-group mode, Top 10 athletes are split out into their own panel,
            while the Black-Shirt panel keeps only the remaining Black-Shirt finishers.
            The dedicated Black-Shirt filter still includes Top 10 Black-Shirt athletes,
            matching the original Streamlit behavior.
          </span>
        </div>

        {model.warning ? (
          <StateBlock
            title="Probability filter note"
            description={model.warning}
            tone="warning"
          />
        ) : null}

        {model.figure ? (
          <PlotlyChart
            data={model.figure.data}
            layout={model.figure.layout}
            className="plot-card--xl"
          />
        ) : (
          <StateBlock
            title="No probability chart available"
            description="No Black-Shirt probability data is available for the current filter selection."
            tone="warning"
          />
        )}
      </div>
    </SectionCard>
  );
}
