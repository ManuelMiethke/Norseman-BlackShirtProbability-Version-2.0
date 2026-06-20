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

export function ParticipantsSection() {
  const { rows, selectedYear, isLoading } = useDashboard();

  if (isLoading) {
    return (
      <SectionCard
        title="Participation Snapshot"
        description="The React version starts with a fast summary layer driven by the packaged race-year dataset."
      >
        <StateBlock
          title="Loading summary"
          description="Reading the shared wide dataset and preparing the overview cards."
        />
      </SectionCard>
    );
  }

  const stats = computeParticipantStats(rows, selectedYear);
  if (!stats) {
    return (
      <SectionCard
        title="Participation Snapshot"
        description="The React version starts with a fast summary layer driven by the packaged race-year dataset."
      >
        <StateBlock
          title="No data available"
          description="The current filter combination does not return a participant summary."
          tone="warning"
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Participation Snapshot"
      description="Counts, finish outcomes, gender balance and country mix are ported first because they are lightweight and define the dashboard’s top-level race context."
    >
      <div className="kpi-grid">
        <article className="hero-kpi">
          <div>
            <span className="hero-kpi__label">Total participants</span>
            <strong>{stats.totalParticipants.toLocaleString()}</strong>
          </div>
          <div className="hero-kpi__divider" />
          <div>
            <span className="hero-kpi__label">Participating countries</span>
            <strong>{stats.participatingCountries.toLocaleString()}</strong>
          </div>
        </article>

        <article className="metric-card">
          <div className="metric-card__header">
            <h4>Gender</h4>
            <span>Same underlying race logic</span>
          </div>
          <RatioBar
            segments={[
              { label: "Men", value: stats.genderCounts.men, color: "#3b82f6" },
              { label: "Women", value: stats.genderCounts.women, color: "#f973c5" },
            ]}
          />
          <div className="metric-card__split">
            <span>Men: {stats.genderCounts.men} ({stats.genderPercentages.men.toFixed(1)}%)</span>
            <span>Women: {stats.genderCounts.women} ({stats.genderPercentages.women.toFixed(1)}%)</span>
          </div>
        </article>

        <article className="metric-card">
          <div className="metric-card__header">
            <h4>Finish types</h4>
            <span>Registry-aware DNF handling</span>
          </div>
          <RatioBar
            segments={[
              { label: "Black", value: stats.finishCounts.black, color: "#111111" },
              { label: "White", value: stats.finishCounts.white, color: "#f3f7fb" },
              { label: "DNF", value: stats.finishCounts.dnf, color: "#ef4444" },
            ]}
          />
          <div className="metric-card__split metric-card__split--three">
            <span>Black: {stats.finishCounts.black} ({stats.finishPercentages.black.toFixed(1)}%)</span>
            <span>White: {stats.finishCounts.white} ({stats.finishPercentages.white.toFixed(1)}%)</span>
            <span>DNF: {stats.finishCounts.dnf} ({stats.finishPercentages.dnf.toFixed(1)}%)</span>
          </div>
        </article>

        <article className="metric-card metric-card--wide">
          <div className="metric-card__header">
            <h4>Most participants</h4>
            <span>Top countries plus rest bucket</span>
          </div>
          <div className="country-grid">
            {stats.topCountries.map((country: typeof stats.topCountries[number]) => (
              <div key={country.code} className="country-chip">
                <span className="country-chip__flag">{country.flag}</span>
                <strong>{country.percentage.toFixed(1)}%</strong>
                <span>{country.code}</span>
              </div>
            ))}
            <div className="country-chip">
              <span className="country-chip__flag">➕</span>
              <strong>{stats.restPercentage.toFixed(1)}%</strong>
              <span>REST</span>
            </div>
          </div>
        </article>
      </div>
    </SectionCard>
  );
}
