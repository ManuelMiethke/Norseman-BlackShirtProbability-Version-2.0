import type { Data, Layout } from "plotly.js";

import type { GroupOption } from "@/config/raceRegistry";
import {
  athleteKey,
  filterRowsByYear,
  isBlackFinishType,
  isTop10Rank,
  isWhiteFinishType,
} from "@/lib/groups";
import type { ModelRow } from "@/types/data";

import { PALETTE } from "@/lib/theme";
type PlotFigure = {
  data: Data[];
  layout: Partial<Layout>;
};

type ProbabilityRow = {
  year: number;
  bib: number;
  finishGroup: "Black Shirt" | "White Shirt";
  splitKey: string;
  leg: "Swim" | "Bike" | "Run";
  distanceKm: number;
  legKm: number;
  xPlot: number;
  blackProb: number;
  splitRank: number | null;
};

type GroupTraceConfig = {
  title: "Top 10" | "Black Shirt" | "White Shirt";
  rows: ProbabilityRow[];
};

export type BlackShirtProbabilityModel = {
  figure: PlotFigure | null;
  warning: string | null;
};

const SWIM_LEN = 3.8;
const BIKE_LEN = 180.0;
const RUN_LEN_DISPLAY = 42.2;
const LEG_GAP = 1.5;

const LEG_OFFSET = {
  Swim: 0,
  Bike: SWIM_LEN + LEG_GAP,
  Run: SWIM_LEN + LEG_GAP + BIKE_LEN + LEG_GAP,
} as const;

const GROUP_COLORS = {
  "Top 10": "#00ff7f",
  "Black Shirt": "#000000",
  "White Shirt": "#ffffff",
} as const;

const MEDIAN_COLOR = PALETTE.accent;
const MEAN_COLOR = PALETTE.mean;

function isFiniteNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function median(values: number[]) {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function mean(values: number[]) {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toFinishGroup(value: string) {
  if (isBlackFinishType(value)) {
    return "Black Shirt" as const;
  }
  if (isWhiteFinishType(value)) {
    return "White Shirt" as const;
  }
  return null;
}

function toLeg(distanceKm: number): "Swim" | "Bike" | "Run" {
  if (distanceKm <= SWIM_LEN) {
    return "Swim";
  }
  if (distanceKm <= SWIM_LEN + BIKE_LEN) {
    return "Bike";
  }
  return "Run";
}

function toLegKm(distanceKm: number, leg: "Swim" | "Bike" | "Run") {
  if (leg === "Swim") {
    return distanceKm;
  }
  if (leg === "Bike") {
    return distanceKm - SWIM_LEN;
  }
  return distanceKm - (SWIM_LEN + BIKE_LEN);
}

function toProbabilityRows(rows: ModelRow[], selectedYear: number | "All") {
  return filterRowsByYear(rows, selectedYear)
    .filter((row) => row.set === undefined || row.set === "test")
    .map((row) => {
      const finishGroup = toFinishGroup(row.finish_type);
      if (
        !finishGroup ||
        !isFiniteNumber(row.race_distance_km) ||
        !isFiniteNumber(row.p_black)
      ) {
        return null;
      }
      const leg = toLeg(row.race_distance_km);
      const legKm = toLegKm(row.race_distance_km, leg);
      const splitRank = isFiniteNumber(row.split_rank) ? row.split_rank : null;
      return {
        year: row.year,
        bib: row.bib,
        finishGroup,
        splitKey: row.split_key,
        leg,
        distanceKm: row.race_distance_km,
        legKm,
        xPlot: legKm + LEG_OFFSET[leg],
        blackProb: row.p_black,
        splitRank,
      } satisfies ProbabilityRow;
    })
    .filter((row): row is ProbabilityRow => row !== null);
}

function determineTop10(rows: ProbabilityRow[], selectedYear: number | "All") {
  const latestByAthlete = new Map<string, ProbabilityRow>();
  for (const row of rows) {
    const athleteId = athleteKey(row, selectedYear === "All");
    const existing = latestByAthlete.get(athleteId);
    if (!existing || row.distanceKm >= existing.distanceKm) {
      latestByAthlete.set(athleteId, row);
    }
  }

  const top10 = new Set<string>();
  for (const [athleteId, row] of latestByAthlete.entries()) {
    if (isTop10Rank(row.splitRank)) {
      top10.add(athleteId);
    }
  }
  return top10;
}

function buildGroups(
  rows: ProbabilityRow[],
  selectedYear: number | "All",
  selectedGroup: GroupOption,
) {
  const top10Keys = determineTop10(rows, selectedYear);

  function isTop10(row: ProbabilityRow) {
    return top10Keys.has(athleteKey(row, selectedYear === "All"));
  }

  if (selectedGroup === "All") {
    return [
      {
        title: "Top 10" as const,
        rows: rows.filter((row) => isTop10(row)),
      },
      {
        title: "Black Shirt" as const,
        rows: rows.filter((row) => row.finishGroup === "Black Shirt" && !isTop10(row)),
      },
      {
        title: "White Shirt" as const,
        rows: rows.filter((row) => row.finishGroup === "White Shirt"),
      },
    ] satisfies GroupTraceConfig[];
  }

  if (selectedGroup === "Top 10") {
    return [
      {
        title: "Top 10" as const,
        rows: rows.filter((row) => isTop10(row)),
      },
    ] satisfies GroupTraceConfig[];
  }

  if (selectedGroup === "Black Shirt") {
    return [
      {
        title: "Black Shirt" as const,
        rows: rows.filter((row) => row.finishGroup === "Black Shirt"),
      },
    ] satisfies GroupTraceConfig[];
  }

  if (selectedGroup === "White Shirt") {
    return [
      {
        title: "White Shirt" as const,
        rows: rows.filter((row) => row.finishGroup === "White Shirt"),
      },
    ] satisfies GroupTraceConfig[];
  }

  return [] satisfies GroupTraceConfig[];
}

function subplotLayout(count: number) {
  const gap = count > 1 ? 0.03 : 0.01;
  const width = (1 - gap * (count - 1)) / count;
  return Array.from({ length: count }, (_, index) => {
    const start = index * (width + gap);
    return [start, start + width] as [number, number];
  });
}

export function buildBlackShirtProbabilityModel(
  modelRows: ModelRow[],
  selectedYear: number | "All",
  selectedGroup: GroupOption,
): BlackShirtProbabilityModel {
  if (selectedGroup === "DNF") {
    return {
      figure: null,
      warning: "Probability view is hidden for DNF.",
    };
  }

  const rows = toProbabilityRows(modelRows, selectedYear);
  if (rows.length === 0) {
    return {
      figure: null,
      warning: "No Black-Shirt probability data is available for the current year filter.",
    };
  }

  const groups = buildGroups(rows, selectedYear, selectedGroup).filter((group) => group.rows.length > 0);
  if (groups.length === 0) {
    return {
      figure: null,
      warning: "No Black-Shirt probability traces remain after applying the current group filter.",
    };
  }

  const runLegMax = Math.max(
    RUN_LEN_DISPLAY,
    ...rows.filter((row) => row.leg === "Run").map((row) => row.legKm),
  );
  const axisEnd = LEG_OFFSET.Run + runLegMax;

  const subplotDomains = subplotLayout(groups.length);
  const annotations: Array<Record<string, unknown>> = [];
  const traces: Data[] = [];
  const shapes: Array<Record<string, unknown>> = [];

  const splitMarks = [
    SWIM_LEN,
    ...[6, 11, 16, 20, 28, 36, 47, 66, 90, 94, 101, 113, 123, 134, 142, 152, 179, 180].map(
      (km) => LEG_OFFSET.Bike + km,
    ),
    ...[5, 10, 15, 20, 25, 32.5, 33, 37.5, 40, 42.2].map((km) => LEG_OFFSET.Run + km),
  ].filter((value) => value >= 0 && value <= axisEnd);

  groups.forEach((group, groupIndex) => {
    const axisId = groupIndex === 0 ? "" : String(groupIndex + 1);
    const xaxisName = `x${axisId}`;
    const yaxisName = `y${axisId}`;
    const [domainStart, domainEnd] = subplotDomains[groupIndex];

    annotations.push({
      text: group.title,
      x: (domainStart + domainEnd) / 2,
      y: 1.02,
      yanchor: "bottom",
      xref: "paper",
      yref: "paper",
      showarrow: false,
      font: {
        size: 14,
        color: "#ffffff",
      },
    });

    let firstLegendTrace = true;
    const athletes = new Map<number, ProbabilityRow[]>();
    for (const row of group.rows) {
      const bucket = athletes.get(row.bib) ?? [];
      bucket.push(row);
      athletes.set(row.bib, bucket);
    }

    for (const [bib, athleteRows] of athletes.entries()) {
      const orderedRows = athleteRows.slice().sort((left, right) => left.distanceKm - right.distanceKm);
      traces.push({
        type: "scatter",
        x: orderedRows.map((row) => row.xPlot),
        y: orderedRows.map((row) => row.blackProb),
        mode: "lines",
        line: {
          color: GROUP_COLORS[group.title],
          width: 1.2,
        },
        opacity: 0.35,
        name: group.title,
        showlegend: firstLegendTrace,
        customdata: orderedRows.map((row) => [bib, row.leg, row.legKm, row.distanceKm]),
        hovertemplate:
          `Group: ${group.title}<br>` +
          "Bib: %{customdata[0]}<br>" +
          "Leg: %{customdata[1]}<br>" +
          "Leg Distance: %{customdata[2]:.1f} km<br>" +
          "Total Distance: %{customdata[3]:.1f} km<br>" +
          "P(Black Shirt): %{y:.2f}<extra></extra>",
        xaxis: xaxisName,
        yaxis: yaxisName,
      } as Data);
      firstLegendTrace = false;
    }

    const statsByX = new Map<number, number[]>();
    for (const row of group.rows) {
      const bucket = statsByX.get(row.xPlot) ?? [];
      bucket.push(row.blackProb);
      statsByX.set(row.xPlot, bucket);
    }

    const statsRows = [...statsByX.entries()]
      .map(([xPlot, values]) => ({
        xPlot,
        median: median(values),
        mean: mean(values),
      }))
      .sort((left, right) => left.xPlot - right.xPlot);

    traces.push({
      type: "scatter",
      x: statsRows.map((row) => row.xPlot),
      y: statsRows.map((row) => row.median),
      mode: "lines",
      line: {
        color: MEDIAN_COLOR,
        width: 3,
        dash: "dash",
      },
      opacity: 0.95,
      name: "Median",
      showlegend: groupIndex === 0,
      hovertemplate: "Median<br>Position: %{x:.1f} km<br>P(Black Shirt): %{y:.2f}<extra></extra>",
      xaxis: xaxisName,
      yaxis: yaxisName,
    } as Data);

    traces.push({
      type: "scatter",
      x: statsRows.map((row) => row.xPlot),
      y: statsRows.map((row) => row.mean),
      mode: "lines",
      line: {
        color: MEAN_COLOR,
        width: 2,
        dash: "dot",
      },
      opacity: 0.85,
      name: "Mean",
      showlegend: groupIndex === 0,
      hovertemplate: "Mean<br>Position: %{x:.1f} km<br>P(Black Shirt): %{y:.2f}<extra></extra>",
      xaxis: xaxisName,
      yaxis: yaxisName,
    } as Data);

    for (const xMark of splitMarks) {
      shapes.push({
        type: "line",
        x0: xMark,
        x1: xMark,
        y0: 0,
        y1: 1,
        xref: xaxisName,
        yref: yaxisName,
        line: {
          width: 1,
          dash: "dot",
          color: "#b0b0b0",
        },
        opacity: 0.6,
        layer: "above",
      });
    }
  });

  const layout: Record<string, unknown> = {
    paper_bgcolor: "#7A7A7A",
    plot_bgcolor: "#7A7A7A",
    font: { color: "#ffffff" },
    height: 650,
    margin: {
      l: 50,
      r: 30,
      t: 80,
      b: 50,
    },
    legend: {
      font: {
        color: "#ffffff",
        size: 13,
      },
    },
    annotations,
    shapes,
  };

  groups.forEach((group, groupIndex) => {
    const axisId = groupIndex === 0 ? "" : String(groupIndex + 1);
    const xaxisKey = `xaxis${axisId}`;
    const yaxisKey = `yaxis${axisId}`;

    layout[xaxisKey] = {
      domain: subplotDomains[groupIndex],
      range: [0, axisEnd],
      title: {
        text: "Leg Distance (km)",
        font: { color: "#ffffff" },
      },
      tickmode: "array",
      tickvals: [
        SWIM_LEN,
        LEG_OFFSET.Bike + 36,
        LEG_OFFSET.Bike + 90,
        LEG_OFFSET.Bike + BIKE_LEN,
        LEG_OFFSET.Run + 21,
        LEG_OFFSET.Run + runLegMax,
      ],
      ticktext: [
        "Swim 3.8",
        "Bike 36",
        "Bike 90",
        "Bike 180",
        "Run 21",
        `Run ${runLegMax.toFixed(1)}`,
      ],
      tickfont: { color: "#ffffff" },
      anchor: `y${axisId}`,
    };

    layout[yaxisKey] = {
      range: [0, 1],
      title: {
        text: groupIndex === 0 ? "P(Black Shirt)" : "",
        font: { color: "#ffffff" },
      },
      tickfont: { color: "#ffffff" },
      anchor: `x${axisId}`,
      showticklabels: true,
    };
  });

  return {
    figure: {
      data: traces,
      layout: layout as Partial<Layout>,
    },
    warning:
      selectedGroup === "Top 10"
        ? "Top 10 is derived from the last available split rank."
        : null,
  };
}
