import { computeParticipantStats } from "@/lib/participants";
import type { CSSProperties } from "react";
import { useDashboard } from "@/state/DashboardContext";
import { ChartInfoPopover } from "@/components/common/ChartInfoPopover";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { PARTICIPATION_INFO } from "@/content/chartInfo";

import { PALETTE } from "@/lib/theme";
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
    <article className="participation-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

function SegmentLegend({
  items,
  className,
}: {
  items: Array<{ label: string; count: string; percentage: string; color: string; weight: number }>;
  className?: string;
}) {
  const total = items.reduce((sum, item) => sum + item.weight, 0) || 1;
  let cumulative = 0;

  return (
    <div className={className ? `participation-legend ${className}` : "participation-legend"}>
      {items.map((item) => {
        const midpoint = ((cumulative + item.weight / 2) / total) * 100;
        cumulative += item.weight;

        return (
          <div
            key={item.label}
            className="participation-split"
            style={
              {
                "--split-left": `${midpoint}%`,
              } as CSSProperties
            }
          >
            <strong>{item.count}</strong>
            <p>{item.percentage}</p>
            <span>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function ParticipantsSection() {
  const { rows, selectedYear, isLoading } = useDashboard();
  const cardClassName = "overview-card overview-card--participants";
  const headerActions = <ChartInfoPopover title="Participation" info={PARTICIPATION_INFO} />;

  if (isLoading) {
    return (
      <SectionCard
        title="Participation"
        className={cardClassName}
        headerActions={headerActions}
      >
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
      <SectionCard
        title="Participation"
        className={cardClassName}
        headerActions={headerActions}
      >
        <StateBlock
          title="No data"
          description="No participant data for this filter."
          tone="warning"
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Participation"
      className={cardClassName}
      headerActions={headerActions}
    >
      <div className="section-stack">
        <div className="participation-summary">
          <SummaryMetric label="Participants" value={stats.totalParticipants.toLocaleString()} />
          <SummaryMetric label="Countries" value={stats.participatingCountries.toLocaleString()} />
        </div>

        <article className="metric-card metric-card--wide participation-panel">
          <div className="metric-card__header">
            <h4>Gender</h4>
          </div>
          <RatioBar
            className="ratio-bar--gender"
            segments={[
              { label: "Men", value: stats.genderCounts.men, color: PALETTE.men },
              { label: "Women", value: stats.genderCounts.women, color: PALETTE.women },
            ]}
          />
          <SegmentLegend
            className="participation-legend--gender"
            items={[
              {
                label: "Men",
                count: stats.genderCounts.men.toLocaleString(),
                percentage: `${stats.genderPercentages.men.toFixed(1)}%`,
                color: PALETTE.men,
                weight: stats.genderCounts.men,
              },
              {
                label: "Women",
                count: stats.genderCounts.women.toLocaleString(),
                percentage: `${stats.genderPercentages.women.toFixed(1)}%`,
                color: PALETTE.women,
                weight: stats.genderCounts.women,
              },
            ]}
          />
        </article>

        <article className="metric-card metric-card--wide participation-panel">
          <div className="metric-card__header">
            <h4>Outcomes</h4>
          </div>
          <RatioBar
            segments={[
              { label: "Black", value: stats.finishCounts.black, color: "#111111" },
              { label: "White", value: stats.finishCounts.white, color: "#f3f7fb" },
              { label: "DNF", value: stats.finishCounts.dnf, color: PALETTE.dnf },
            ]}
          />
          <SegmentLegend
            className="participation-legend--outcomes"
            items={[
              {
                label: "Black",
                count: stats.finishCounts.black.toLocaleString(),
                percentage: `${stats.finishPercentages.black.toFixed(1)}%`,
                color: "#111111",
                weight: stats.finishCounts.black,
              },
              {
                label: "White",
                count: stats.finishCounts.white.toLocaleString(),
                percentage: `${stats.finishPercentages.white.toFixed(1)}%`,
                color: "#f3f7fb",
                weight: stats.finishCounts.white,
              },
              {
                label: "DNF",
                count: stats.finishCounts.dnf.toLocaleString(),
                percentage: `${stats.finishPercentages.dnf.toFixed(1)}%`,
                color: PALETTE.dnf,
                weight: stats.finishCounts.dnf,
              },
            ]}
          />
        </article>
      </div>
    </SectionCard>
  );
}
