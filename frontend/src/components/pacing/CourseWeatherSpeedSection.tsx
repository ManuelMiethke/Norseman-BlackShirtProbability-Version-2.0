import { PlotlyChart } from "@/components/common/PlotlyChart";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { useCourseProfileData } from "@/hooks/useCourseProfileData";
import { useLongData } from "@/hooks/useLongData";
import { buildCourseWeatherSpeedModel } from "@/lib/courseWeatherSpeed";
import { useDashboard } from "@/state/DashboardContext";

export function CourseWeatherSpeedSection() {
  const longData = useLongData();
  const courseData = useCourseProfileData();
  const { selectedYear, selectedGroup } = useDashboard();

  if (longData.isLoading || courseData.isLoading) {
    return (
      <SectionCard
        title="Course, Weather & Speed"
        description="This React section combines the course profile, sparse weather checkpoints and group median segment speed for the selected race year."
      >
        <StateBlock
          title="Loading course context"
          description="Preparing split history, weather checkpoints and course profile data."
        />
      </SectionCard>
    );
  }

  if (longData.error || courseData.error) {
    return (
      <SectionCard
        title="Course, Weather & Speed"
        description="This React section combines the course profile, sparse weather checkpoints and group median segment speed for the selected race year."
      >
        <StateBlock
          title="Course data load failed"
          description={longData.error ?? courseData.error ?? "Unknown data loading error."}
          tone="error"
        />
      </SectionCard>
    );
  }

  const { figure, warning, effectiveYear } = buildCourseWeatherSpeedModel(
    longData.rows,
    courseData.rows,
    selectedYear,
    selectedGroup,
  );

  return (
    <SectionCard
      title="Course, Weather & Speed"
      description="This preserves the original combined course profile chart: median group speed is layered over the Norseman route with elevation, sparse weather markers and directional wind hints."
    >
      <div className="section-stack">
        <div className="section-note">
          <strong>Rendered year</strong>
          <span>
            {selectedYear === "All"
              ? `The original Streamlit behavior is preserved here: "All" falls back to the latest available year, currently ${effectiveYear ?? "unknown"}.`
              : `The chart is currently rendered for ${effectiveYear ?? selectedYear} with group filter "${selectedGroup}".`}
          </span>
        </div>

        {warning ? (
          <StateBlock
            title="Group note"
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
