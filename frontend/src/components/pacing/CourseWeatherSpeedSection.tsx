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
      <SectionCard title="Course / Weather / Speed">
        <StateBlock
          title="Loading"
          description="Preparing course context."
        />
      </SectionCard>
    );
  }

  if (longData.error || courseData.error) {
    return (
      <SectionCard title="Course / Weather / Speed">
        <StateBlock
          title="Load failed"
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
    <SectionCard title="Course / Weather / Speed">
      <div className="section-stack">
        <div className="section-note">
          <strong>Year</strong>
          <span>
            {selectedYear === "All"
              ? `All uses the latest year: ${effectiveYear ?? "unknown"}.`
              : `The chart is currently rendered for ${effectiveYear ?? selectedYear} with group filter "${selectedGroup}".`}
          </span>
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
            className="plot-card--xl"
          />
        ) : null}
      </div>
    </SectionCard>
  );
}
