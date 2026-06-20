import { ParticipantsSection } from "@/components/overview/ParticipantsSection";
import { TimeRelationsSection } from "@/components/overview/TimeRelationsSection";
import { WhoAreWeRacingSection } from "@/components/overview/WhoAreWeRacingSection";
import { YearComparisonSection } from "@/components/overview/YearComparisonSection";
import { useDashboard } from "@/state/DashboardContext";
import { StateBlock } from "@/components/common/StateBlock";

export function OverviewPage() {
  const { error } = useDashboard();

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div>
          <span className="page-hero__eyebrow">Overview Route</span>
          <h1>React overview migration</h1>
          <p>
            This route now covers four analytical building blocks of the original dashboard overview: participation context, distance-vs-time relations, the cross-year median comparison and the first long-data race-pressure view. The Streamlit version stays available in parallel while the remaining pages are ported.
          </p>
        </div>
        <div className="page-hero__badge">
          <strong>Phase 2</strong>
          <span>Expanded overview port</span>
        </div>
      </section>

      {error ? (
        <StateBlock
          title="Dataset load failed"
          description={error}
          tone="error"
        />
      ) : null}

      <ParticipantsSection />
      <TimeRelationsSection />
      <YearComparisonSection />
      <WhoAreWeRacingSection />
    </div>
  );
}
