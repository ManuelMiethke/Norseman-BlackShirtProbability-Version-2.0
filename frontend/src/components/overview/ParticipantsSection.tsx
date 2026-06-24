import { computeParticipantStats } from "@/lib/participants";
import { useDashboard } from "@/state/DashboardContext";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";

function RatioBar({
  segments,
  className,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  className?: string;
}) {
  const total = segments.reduce((sum, item) => sum + item.value, 0) || 1;
  return (
    <div className={className ? `ratio-bar ${className}` : "ratio-bar"}>
      {segments.map((segment) => (
        <div
          key={segment.label}
          className="ratio-bar__segment"
          style={{
            width: `${(segment.value / total) * 100}%`,
            background: segment.color,
          }}
          title={`${segment.label}: ${segment.value}`}
        />
      ))}
    </div>
  );
}

function SummaryMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article className="participation-summary__metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

function SplitLabel({
  label,
  value,
  align = "left",
}: {
  label: string;
  value: string;
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "participation-split participation-split--right" : "participation-split"}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export function ParticipantsSection() {
  const { rows, selectedYear, isLoading } = useDashboard();
  const cardClassName = "overview-card overview-card--participants";

  if (isLoading) {
    return (
      <SectionCard title="Participation" className={cardClassName}>
        <StateBlock
          title="Loading"
          description="Preparing summary cards."
        />
      </SectionCard>
    );
  }

  const stats = computeParticipantStats(rows, selectedYear);
  if (!stats) {
    return (
      <SectionCard title="Participation" className={cardClassName}>
        <StateBlock
          title="No data"
          description="No participant data for this filter."
          tone="warning"
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Participation" className={cardClassName}>
      <div className="section-stack">
        <div className="participation-summary">
          <SummaryMetric label="Total participants" value={stats.totalParticipants.toLocaleString()} />
          <div className="participation-summary__divider" />
          <SummaryMetric label="Participating countries" value={stats.participatingCountries.toLocaleString()} />
        </div>

        <article className="metric-card metric-card--wide">
          <div className="metric-card__header">
            <h4>Gender</h4>
          </div>
          <RatioBar
            className="ratio-bar--gender"
            segments={[
              { label: "Men", value: stats.genderCounts.men, color: "#4d82e8" },
              { label: "Women", value: stats.genderCounts.women, color: "#ec6bbb" },
            ]}
          />
          <div className="participation-gender">
            <SplitLabel
              label="Men"
              value={`${stats.genderCounts.men} (${stats.genderPercentages.men.toFixed(1)}%)`}
            />
            <SplitLabel
              label="Women"
              value={`${stats.genderCounts.women} (${stats.genderPercentages.women.toFixed(1)}%)`}
              align="right"
            />
          </div>
        </article>

        <article className="metric-card metric-card--wide">
          <div className="metric-card__header">
            <h4>Outcomes</h4>
            <span>Race mix</span>
          </div>
          <RatioBar
            segments={[
              { label: "Black", value: stats.finishCounts.black, color: "#111111" },
              { label: "White", value: stats.finishCounts.white, color: "#f3f7fb" },
              { label: "DNF", value: stats.finishCounts.dnf, color: "#ef4444" },
            ]}
          />
          <div className="metric-card__split metric-card__split--three participation-outcomes">
            <SplitLabel
              label="Black"
              value={`${stats.finishCounts.black} (${stats.finishPercentages.black.toFixed(1)}%)`}
            />
            <SplitLabel
              label="White"
              value={`${stats.finishCounts.white} (${stats.finishPercentages.white.toFixed(1)}%)`}
              align="right"
            />
            <SplitLabel
              label="DNF"
              value={`${stats.finishCounts.dnf} (${stats.finishPercentages.dnf.toFixed(1)}%)`}
            />
          </div>
        </article>
      </div>
    </SectionCard>
  );
}
