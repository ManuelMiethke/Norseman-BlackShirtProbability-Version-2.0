import { computeParticipantStats } from "@/lib/participants";
import { useDashboard } from "@/state/DashboardContext";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";

function RatioBar({
  segments,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
}) {
  const total = segments.reduce((sum, item) => sum + item.value, 0) || 1;
  return (
    <div className="ratio-bar">
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

function MiniKpi({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article className="mini-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
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
        <div className="mini-kpi-grid">
          <MiniKpi label="Athletes" value={stats.totalParticipants.toLocaleString()} />
          <MiniKpi label="Countries" value={stats.participatingCountries.toLocaleString()} />
          <MiniKpi label="Black" value={`${stats.finishPercentages.black.toFixed(1)}%`} />
          <MiniKpi label="Women" value={`${stats.genderPercentages.women.toFixed(1)}%`} />
        </div>

        <article className="metric-card">
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
          <div className="metric-card__split metric-card__split--three">
            <span>Black {stats.finishPercentages.black.toFixed(1)}%</span>
            <span>White {stats.finishPercentages.white.toFixed(1)}%</span>
            <span>DNF {stats.finishPercentages.dnf.toFixed(1)}%</span>
          </div>
        </article>
      </div>
    </SectionCard>
  );
}
