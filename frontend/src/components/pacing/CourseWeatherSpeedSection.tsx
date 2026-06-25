import { ChartInfoPopover } from "@/components/common/ChartInfoPopover";
import { PlotlyChart } from "@/components/common/PlotlyChart";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { COURSE_WEATHER_SPEED_INFO } from "@/content/chartInfo";
import { useCourseProfileData } from "@/hooks/useCourseProfileData";
import { useLongData } from "@/hooks/useLongData";
import { buildCourseWeatherSpeedModel } from "@/lib/courseWeatherSpeed";
import { useDashboard } from "@/state/DashboardContext";

export function CourseWeatherSpeedSection() {
  const longData = useLongData();
  const courseData = useCourseProfileData();
  const { selectedYear, selectedGroup } = useDashboard();
  const headerActions = (
    <div className="section-toolbar">
      <ChartInfoPopover title="Course / Weather / Speed" info={COURSE_WEATHER_SPEED_INFO} />
    </div>
  );

  if (longData.isLoading || courseData.isLoading) {
    return (
      <SectionCard title="Course / Weather / Speed" headerActions={headerActions}>
        <StateBlock
          title="Loading"
          description="Preparing course context."
        />
      </SectionCard>
    );
  }

  if (longData.error || courseData.error) {
    return (
      <SectionCard title="Course / Weather / Speed" headerActions={headerActions}>
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
    <SectionCard title="Course / Weather / Speed" headerActions={headerActions}>
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
            className="plot-card--panorama"
          />
        ) : null}
      </div>
    </SectionCard>
  );
}
