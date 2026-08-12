import { ChartInfoPopover } from "@/components/common/ChartInfoPopover";
import { SectionCard } from "@/components/common/SectionCard";
import { COURSE_OVERVIEW_3D_INFO } from "@/content/chartInfo";

export function CourseOverview3DSection() {
  const headerActions = (
    <div className="section-toolbar">
      <ChartInfoPopover title="3D Course Overview" info={COURSE_OVERVIEW_3D_INFO} />
    </div>
  );

  return (
    <SectionCard
      title="3D Course Overview"
      className="pacing-card pacing-card--course-overview"
      headerActions={headerActions}
    >
      <iframe
        title="Norseman 3D course overview"
        src="/gpx-overview/index.html"
        className="course-overview-frame"
        loading="lazy"
      />
    </SectionCard>
  );
}
