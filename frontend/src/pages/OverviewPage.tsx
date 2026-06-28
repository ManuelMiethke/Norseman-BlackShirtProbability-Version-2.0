import { HistogramsSection } from "@/components/overview/HistogramsSection";
import { ParticipantsSection } from "@/components/overview/ParticipantsSection";
import { RankProgressionSection } from "@/components/overview/RankProgressionSection";
import { TimeRelationsSection } from "@/components/overview/TimeRelationsSection";
import { WhoAreWeRacingSection } from "@/components/overview/WhoAreWeRacingSection";
import { YearComparisonSection } from "@/components/overview/YearComparisonSection";
import { useDashboard } from "@/state/DashboardContext";
import { StateBlock } from "@/components/common/StateBlock";

export function OverviewPage() {
  const { error } = useDashboard();

  return (
    <div className="dashboard-page">
      {error ? (
        <StateBlock
          title="Dataset load failed"
          description={error}
          tone="error"
        />
      ) : null}

      <div className="dashboard-grid dashboard-grid--overview">
        <ParticipantsSection />
        <TimeRelationsSection />
        <WhoAreWeRacingSection />
        <YearComparisonSection />
        <HistogramsSection />
        <RankProgressionSection />
      </div>
    </div>
  );
}
