import type { Layout, Data } from "plotly.js";

import type { GroupOption } from "@/config/raceRegistry";
import {
  filterRowsByYear,
  isBlackFinishType,
  isCompleteFinisher,
  matchesGroup,
  isWhiteFinishType,
} from "@/lib/groups";
import { formatDelta, secondsToHms, timeToSeconds } from "@/lib/time";
import type { WideRow } from "@/types/data";

import { PALETTE } from "@/lib/theme";
const SEGMENT_LABELS = ["Swim", "Bike", "Run"];
const SEGMENT_DISTANCES = [3.8, 180.2, 42.2];
const SEGMENT_COLORS = {
  Swim: PALETTE.swim,
  Bike: PALETTE.bike,
  Run: PALETTE.run,
};

type GroupFigure = {
  key: string;
  title: string;
  data: Data[];
  layout: Partial<Layout>;
};

function buildPieFigure(
  title: string,
  values: number[],
  text: string[],
  titleBackground: string,
  titleColor: string,
): GroupFigure {
  return {
    key: title,
    title,
    data: [
      {
        type: "pie",
        labels: SEGMENT_LABELS,
        values,
        hole: 0.4,
        marker: {
          colors: SEGMENT_LABELS.map((label) => SEGMENT_COLORS[label as keyof typeof SEGMENT_COLORS]),
        },
        text,
        textinfo: "text",
        textposition: "inside",
        insidetextorientation: "horizontal",
        domain: {
          x: [0.04, 0.96],
          y: [0.04, 0.96],
        },
        textfont: {
          size: 14,
          color: "#ffffff",
        },
        hovertemplate: "%{label}<br>%{text}<extra></extra>",
      },
    ],
    layout: {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      margin: { t: 12, r: 8, b: 12, l: 8 },
      showlegend: false,
      annotations: [
        {
          text: `<b>${title}</b>`,
          x: 0.06,
          y: 0.95,
          xref: "paper",
          yref: "paper",
          showarrow: false,
          xanchor: "left",
          yanchor: "top",
          font: {
            color: titleColor,
            size: 15,
            family: "IBM Plex Sans, sans-serif",
          },
          bgcolor: titleBackground,
          align: "left",
          borderpad: 5,
        },
      ],
      height: 360,
    },
  };
}

function normalizeRows(rows: WideRow[]) {
  return rows
    .map((row) => ({
      ...row,
      swimTimeSeconds: timeToSeconds(row.swim_time ?? null),
      bikeTimeSeconds: timeToSeconds(row.bike_time ?? null),
      runTimeSeconds: timeToSeconds(row.run_time ?? null),
      overallRankValue:
        typeof row.overall_rank === "number" ? row.overall_rank : Number(row.overall_rank ?? NaN),
    }))
    .filter((row) => row.swimTimeSeconds !== null && row.bikeTimeSeconds !== null && row.runTimeSeconds !== null);
}

function referenceBlack(rows: ReturnType<typeof normalizeRows>) {
  const blackRows = rows.filter((row) => isBlackFinishType(row.finish_type));
  if (blackRows.length === 0) {
    return null;
  }

  return {
    swim: median(blackRows.map((row) => row.swimTimeSeconds!)),
    bike: median(blackRows.map((row) => row.bikeTimeSeconds!)),
    run: median(blackRows.map((row) => row.runTimeSeconds!)),
  };
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function figureForGroup(
  rows: ReturnType<typeof normalizeRows>,
  group: Exclude<GroupOption, "All" | "DNF">,
  deltaOnly: boolean,
  blackReference: { swim: number; bike: number; run: number } | null,
): GroupFigure | null {
  const finisherRows = rows.filter((row) => isCompleteFinisher(row));
  const groupRows = finisherRows.filter((row) =>
    matchesGroup(
      {
        finish_type: row.finish_type,
        overall_rank: row.overallRankValue,
      },
      group,
    ),
  );

  if (groupRows.length === 0) {
    return null;
  }

  const swim = median(groupRows.map((row) => row.swimTimeSeconds!));
  const bike = median(groupRows.map((row) => row.bikeTimeSeconds!));
  const run = median(groupRows.map((row) => row.runTimeSeconds!));
  const values = [swim, bike, run];
  const total = values.reduce((sum, value) => sum + value, 0);
  const percentages = values.map((value) => (value / total) * 100);

  const text = deltaOnly
    ? group === "Black Shirt"
      ? ["Δ +00:00:00", "Δ +00:00:00", "Δ +00:00:00"]
      : [
          formatDelta(swim - (blackReference?.swim ?? swim)),
          formatDelta(bike - (blackReference?.bike ?? bike)),
          formatDelta(run - (blackReference?.run ?? run)),
        ]
    : values.map((value, index) => `${secondsToHms(value)}<br>${percentages[index].toFixed(1)} %`);

  const style =
    group === "Top 10"
      ? { background: "#b7ffb7", color: "#000000" }
      : group === "Black Shirt"
        ? { background: "#000000", color: "#ffffff" }
        : { background: "#ffffff", color: "#000000" };

  return buildPieFigure(group, percentages, text, style.background, style.color);
}

export function buildTimeRelationFigures(
  rows: WideRow[],
  selectedYear: number | "All",
  selectedGroup: GroupOption,
  deltaOnly: boolean,
) {
  const scopedRows = filterRowsByYear(rows, selectedYear);
  const normalized = normalizeRows(scopedRows);
  const distanceTotal = SEGMENT_DISTANCES.reduce((sum, value) => sum + value, 0);
  const distancePercentages = SEGMENT_DISTANCES.map((value) => (value / distanceTotal) * 100);
  const distanceText = SEGMENT_DISTANCES.map(
    (value, index) => `${value.toFixed(1)} km<br>${distancePercentages[index].toFixed(1)} %`,
  );

  const figures: GroupFigure[] = [
    buildPieFigure("Distance", distancePercentages, distanceText, "rgba(0,0,0,0)", "#ffffff"),
  ];

  if (selectedGroup === "DNF") {
    return {
      figures,
      note: "Time-share charts are not shown for DNF athletes because they did not complete the full race.",
    };
  }

  const groups: Array<Exclude<GroupOption, "All" | "DNF">> =
    selectedGroup === "All" ? ["Top 10", "Black Shirt", "White Shirt"] : [selectedGroup];

  const black = referenceBlack(normalized);
  for (const group of groups) {
    const figure = figureForGroup(normalized, group, deltaOnly, black);
    if (figure) {
      figures.push(figure);
    }
  }

  return { figures, note: null as string | null };
}
