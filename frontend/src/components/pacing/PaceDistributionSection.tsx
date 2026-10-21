import { Fragment, useState } from "react";

import { ChartInfoPopover } from "@/components/common/ChartInfoPopover";
import { PlotlyChart } from "@/components/common/PlotlyChart";
import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { PACE_DISTRIBUTION_INFO } from "@/content/chartInfo";
import {
  buildPaceDistributionModel,
  type PaceLegModel,
  type PaceStatsCell,
} from "@/lib/pacingDistributions";
import { useDashboard } from "@/state/DashboardContext";

function toneFromGroup(group: PaceStatsCell["group"]) {
  if (group === "Top 10") {
    return "top10";
  }
  if (group === "Black Shirt") {
    return "black";
  }
  if (group === "Places 140–180") {
    return "band";
  }
  return "white";
}

const UNIT_PATTERN = /\s*(min\/100m|min\/km|km\/h)$/;

/** Moves the unit into the column header so every cell fits on one line. */
function stripUnit(line: string) {
  return line.replace(UNIT_PATTERN, "");
}

function unitOf(leg: PaceLegModel) {
  for (const row of leg.table.rows) {
    for (const cell of row.cells) {
      for (const line of cell.secondaryLines) {
        const match = line.match(UNIT_PATTERN);
        if (match) return match[1];
      }
    }
  }
  return null;
}

function PaceCellGroup({
  cell,
  showSecondary,
}: {
  cell: PaceStatsCell;
  showSecondary: boolean;
}) {
  const tone = toneFromGroup(cell.group);

  return (
    <>
      <td className={`pace-table__group--${tone}`}>{cell.time || "—"}</td>
      {showSecondary ? (
        <td className={`pace-table__group--${tone}`}>
          {cell.secondaryLines.length > 0 ? (
            <div className="pace-table__stack">
              {cell.secondaryLines.map((line) => (
                <span key={line}>{stripUnit(line)}</span>
              ))}
            </div>
          ) : (
            "—"
          )}
        </td>
      ) : null}
    </>
  );
}

function PaceLegPanel({
  leg,
  statsOpen,
  onStatsToggle,
}: {
  leg: PaceLegModel;
  statsOpen: boolean;
  onStatsToggle: (open: boolean) => void;
}) {
  const hasSecondaryColumn = leg.table.secondaryLabel !== null;
  const unit = unitOf(leg);
  const secondaryHeader = unit ?? leg.table.secondaryLabel;

  return (
    <article className="pacing-leg-panel">
      <PlotlyChart
        data={leg.figure.data}
        layout={leg.figure.layout}
        className="plot-card--pace"
      />

      {/* All legs share one open state, so the tables expand together and line up. */}
      <details
        className="disclosure-panel"
        open={statsOpen}
        onToggle={(event) => {
          const { open } = event.currentTarget;
          if (open !== statsOpen) {
            onStatsToggle(open);
          }
        }}
      >
        <summary>
          <span>Median / Std / Min / Max</span>
          <span className="disclosure-panel__chevron">⌄</span>
        </summary>

        <div className="disclosure-panel__body">
          {leg.table.emptyMessage ? (
            <div className="section-note">
              <strong>Stats unavailable</strong>
              <span>{leg.table.emptyMessage}</span>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="pace-table">
                <thead>
                  <tr>
                    <th rowSpan={2}>Metric</th>
                    {leg.table.groups.map((group) => (
                      <th
                        key={group.key}
                        colSpan={hasSecondaryColumn ? 2 : 1}
                        className={`pace-table__group pace-table__group--${group.tone}`}
                      >
                        {group.key}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {leg.table.groups.map((group) => (
                      <Fragment key={`${leg.id}-${group.key}`}>
                        <th className={`pace-table__subhead pace-table__group--${group.tone}`}>
                          Time
                        </th>
                        {hasSecondaryColumn ? (
                          <th className={`pace-table__subhead pace-table__group--${group.tone}`}>
                            {secondaryHeader}
                          </th>
                        ) : null}
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leg.table.rows.map((row) => (
                    <tr key={row.metric}>
                      <td className="pace-table__metric">{row.metric}</td>
                      {row.cells.map((cell) => (
                        <PaceCellGroup
                          key={`${row.metric}-${cell.group}`}
                          cell={cell}
                          showSecondary={hasSecondaryColumn}
                        />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </details>
    </article>
  );
}

export function PaceDistributionSection() {
  const {
    rows,
    selectedYear,
    selectedGroup,
    isLoading,
    error,
  } = useDashboard();
  const [showZombieHill, setShowZombieHill] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const headerActions = <ChartInfoPopover title="Pace Distribution" info={PACE_DISTRIBUTION_INFO} />;
  const footerControls = (
    <div className="section-controls section-controls--footer">
      <label className="toggle-pill">
        <input
          type="checkbox"
          checked={showZombieHill}
          onChange={(event) => setShowZombieHill(event.target.checked)}
        />
        <span>Zombie Hill</span>
      </label>
    </div>
  );

  if (isLoading) {
    return (
      <SectionCard title="Pace Distribution" headerActions={headerActions}>
        <StateBlock
          title="Loading"
          description="Preparing pace charts."
        />
      </SectionCard>
    );
  }

  if (error) {
    return (
      <SectionCard title="Pace Distribution" headerActions={headerActions}>
        <StateBlock
          title="Load failed"
          description={error}
          tone="error"
        />
      </SectionCard>
    );
  }

  const model = buildPaceDistributionModel(rows, selectedYear, selectedGroup);

  return (
    <SectionCard title="Pace Distribution" headerActions={headerActions}>
      <div className="section-stack">
        {model.warning ? (
          <StateBlock
            title="Note"
            description={model.warning}
            tone="warning"
          />
        ) : null}

        {model.primaryLegs.length > 0 ? (
          <div className="pacing-grid">
            {model.primaryLegs.map((leg) => (
              <PaceLegPanel
                key={leg.id}
                leg={leg}
                statsOpen={statsOpen}
                onStatsToggle={setStatsOpen}
              />
            ))}
            {showZombieHill && model.zombieHill ? (
              <PaceLegPanel
                leg={model.zombieHill}
                statsOpen={statsOpen}
                onStatsToggle={setStatsOpen}
              />
            ) : null}
          </div>
        ) : (
          <StateBlock
            title="No data"
            description="No usable timing data for this filter."
            tone="warning"
          />
        )}

        {footerControls}
      </div>
    </SectionCard>
  );
}
