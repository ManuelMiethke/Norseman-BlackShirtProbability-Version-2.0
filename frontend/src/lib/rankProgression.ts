import type { Data, Layout } from "plotly.js";

import { RACE_YEAR_REGISTRY, type GroupOption } from "@/config/raceRegistry";
import {
  isBlackFinishType,
  isDnfFinishType,
  isWhiteFinishType,
} from "@/lib/groups";
import type { LongRow } from "@/types/data";

const SWIM_KM = 3.8;
const BIKE_KM = 180.0;
const TOP10_COLORS = [
  "#1F77B4",
  "#FF7F0E",
  "#2CA02C",
  "#D62728",
  "#9467BD",
  "#17BECF",
  "#BCBD22",
  "#E377C2",
  "#8C564B",
  "#AEC7E8",
];
const CONTENDER_COLOR = "rgba(60, 60, 60, 0.85)";
const GRID_COLOR = "rgba(255,255,255,0.25)";

type PlotFigure = {
  data: Data[];
  layout: Partial<Layout>;
};

type RankMode = "Top 10 finishers" | "All athletes to cut-off";

type RankRow = {
  bib: number;
  name: string;
  finishType: string;
  overallRankValue: number | null;
  splitRank: number;
  raceDistanceKm: number;
  year: number;
};

export type RankProgressionModel = {
  figure: PlotFigure | null;
  warning: string | null;
  description: string;
};

type RaceStructure = {
  swimEnd: number;
  bikeEnd: number;
  runEnd: number;
  runKm: number;
  finishKm: number;
  extraTicks: Array<[number, string]>;
};

function fixNorwegianMojibake(value: string): string {
  const replacements: Record<string, string> = {
    "√©": "é",
    "√®": "®",
    "√™": "™",
    "√•": "å",
    "√¶": "ö",
    "√∏": "ø",
    "√∂": "ø",
    "√º": "å",
    "√Ñ": "Å",
    "√Å": "Å",
    "√ª": "æ",
    "√Ä": "Ä",
    "√Ö": "Ö",
    "√Ü": "Ü",
    "√∫": "ú",
    "√ú": "ú",
    "√ù": "ù",
    "√í": "í",
    "√ó": "ó",
    "√ò": "ò",
    "√ß": "ß",
    "√±": "ñ",
  };

  let output = value;
  for (const [source, target] of Object.entries(replacements)) {
    output = output.split(source).join(target);
  }
  return output;
}

function raceStructureForYear(year: number): RaceStructure | null {
  const registry = RACE_YEAR_REGISTRY[year];
  if (!registry) {
    return null;
  }

  const swimEnd = SWIM_KM;
  const bikeEnd = SWIM_KM + BIKE_KM;
  const runEnd = bikeEnd + registry.cutoffRunKm;

  return {
    swimEnd,
    bikeEnd,
    runEnd,
    runKm: registry.cutoffRunKm,
    finishKm: registry.finishDistanceKm,
    extraTicks: [
      [swimEnd + 47.0, "Bike\n47"],
      [swimEnd + 90.0, "Bike\n90"],
      [swimEnd + 142.0, "Bike\n142"],
      [bikeEnd + 20.0, "Run\n20"],
    ],
  };
}

function normalizeRankRows(rows: LongRow[], year: number): RankRow[] {
  const scoped = rows
    .filter(
      (row) =>
        Number(row.year) === year &&
        Number.isFinite(row.bib) &&
        Number.isFinite(row.race_distance_km) &&
        Number.isFinite(row.split_rank),
    )
    .map((row) => ({
      bib: Number(row.bib),
      name: fixNorwegianMojibake(String(row.name ?? "")),
      finishType: String(row.finish_type ?? ""),
      overallRankValue:
        row.overall_rank === undefined || row.overall_rank === null || !Number.isFinite(Number(row.overall_rank))
          ? null
          : Number(row.overall_rank),
      splitRank: Number(row.split_rank),
      raceDistanceKm: Number(row.race_distance_km),
      year: Number(row.year),
      cumTimeSeconds:
        row.cum_time_seconds === undefined || row.cum_time_seconds === null
          ? Number.POSITIVE_INFINITY
          : Number(row.cum_time_seconds),
    }))
    .sort((left, right) => {
      if (left.bib !== right.bib) {
        return left.bib - right.bib;
      }
      if (left.raceDistanceKm !== right.raceDistanceKm) {
        return left.raceDistanceKm - right.raceDistanceKm;
      }
      return left.cumTimeSeconds - right.cumTimeSeconds;
    });

  const deduped: RankRow[] = [];
  const seen = new Set<string>();

  for (const row of scoped) {
    const key = `${row.bib}:${row.raceDistanceKm}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push({
      bib: row.bib,
      name: row.name,
      finishType: row.finishType,
      overallRankValue: row.overallRankValue,
      splitRank: row.splitRank,
      raceDistanceKm: row.raceDistanceKm,
      year: row.year,
    });
  }

  return deduped;
}

function contiguousSegments(rows: Array<RankRow & { inRange: boolean }>) {
  const segments: Array<Array<RankRow & { inRange: boolean }>> = [];
  let current: Array<RankRow & { inRange: boolean }> = [];

  for (const row of rows) {
    if (row.inRange) {
      current.push(row);
      continue;
    }

    if (current.length > 0) {
      segments.push(current);
      current = [];
    }
  }

  if (current.length > 0) {
    segments.push(current);
  }

  return segments;
}

function buildSharedLayout(height: number): Partial<Layout> {
  return {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "#eef5fb", family: "IBM Plex Sans, sans-serif" },
    height,
    margin: { l: 40, r: 20, t: 20, b: 40 },
  };
}

function athleteColor(finishType: string, top10AtCutoff: boolean): string {
  if (isDnfFinishType(finishType)) {
    return "#FF0000";
  }

  if (top10AtCutoff) {
    return "#00C853";
  }

  if (isBlackFinishType(finishType)) {
    return "#000000";
  }

  if (isWhiteFinishType(finishType)) {
    return "#FFFFFF";
  }

  return "#FFFFFF";
}

function athleteInGroup(
  finishType: string,
  top10AtCutoff: boolean,
  group: GroupOption,
): boolean {
  if (group === "All") {
    return true;
  }

  if (group === "Top 10") {
    return top10AtCutoff;
  }

  if (group === "Black Shirt") {
    return isBlackFinishType(finishType);
  }

  if (group === "White Shirt") {
    return isWhiteFinishType(finishType);
  }

  if (group === "DNF") {
    return isDnfFinishType(finishType);
  }

  return true;
}

function buildTop10Figure(rows: RankRow[], year: number, focusTop10: boolean): PlotFigure | null {
  const structure = raceStructureForYear(year);
  if (!structure) {
    return null;
  }

  const finishKm = structure.finishKm;
  const clipped = rows
    .filter((row) => row.raceDistanceKm <= finishKm)
    .map((row) => ({ ...row }));

  const maxDistanceByBib = new Map<number, number>();
  for (const row of clipped) {
    const current = maxDistanceByBib.get(row.bib) ?? Number.NEGATIVE_INFINITY;
    if (row.raceDistanceKm > current) {
      maxDistanceByBib.set(row.bib, row.raceDistanceKm);
    }
  }

  for (const row of clipped) {
    const isLastPlotted = row.raceDistanceKm === maxDistanceByBib.get(row.bib);
    if (isLastPlotted && row.overallRankValue !== null && row.overallRankValue >= 1 && row.overallRankValue <= 10) {
      row.splitRank = row.overallRankValue;
    }
  }

  const finishers = [...new Map(
    clipped
      .filter((row) => row.overallRankValue !== null && row.overallRankValue >= 1 && row.overallRankValue <= 10)
      .map((row) => [row.bib, { bib: row.bib, name: row.name, overallRankValue: row.overallRankValue! }]),
  ).values()].sort((left, right) => left.overallRankValue - right.overallRankValue);

  if (finishers.length === 0) {
    return null;
  }

  const data: Data[] = [];

  if (focusTop10) {
    for (const finisher of finishers) {
      const color = TOP10_COLORS[(finisher.overallRankValue - 1) % TOP10_COLORS.length];
      const athleteRows = clipped
        .filter((row) => row.bib === finisher.bib)
        .sort((left, right) => left.raceDistanceKm - right.raceDistanceKm)
        .map((row) => ({
          ...row,
          inRange: row.splitRank >= 1 && row.splitRank <= 10,
        }));

      contiguousSegments(athleteRows).forEach((segment, index) => {
        data.push({
          type: "scatter",
          mode: "lines+markers",
          x: segment.map((row) => row.raceDistanceKm),
          y: segment.map((row) => row.splitRank),
          name: `${finisher.overallRankValue}. ${finisher.name} (#${finisher.bib})`,
          showlegend: index === 0,
          line: { width: 3, color },
          marker: { size: 8, color },
        });
      });
    }

    const finisherBibs = new Set(finishers.map((row) => row.bib));
    const contenderBibs = [...new Set(
      clipped
        .filter((row) => row.splitRank >= 1 && row.splitRank <= 10)
        .map((row) => row.bib),
    )].filter((bib) => !finisherBibs.has(bib));

    for (const bib of contenderBibs) {
      const athleteRows = clipped
        .filter((row) => row.bib === bib)
        .sort((left, right) => left.raceDistanceKm - right.raceDistanceKm)
        .map((row) => ({
          ...row,
          inRange: row.splitRank >= 1 && row.splitRank <= 10,
        }));

      contiguousSegments(athleteRows).forEach((segment) => {
        data.push({
          type: "scatter",
          mode: "lines+markers",
          x: segment.map((row) => row.raceDistanceKm),
          y: segment.map((row) => row.splitRank),
          showlegend: false,
          line: { width: 2, color: CONTENDER_COLOR },
          marker: { size: 6, color: CONTENDER_COLOR },
          hovertemplate: `#${bib}<br>km=%{x}<br>rank=%{y}<extra></extra>`,
        });
      });
    }
  } else {
    for (const finisher of finishers) {
      const color = TOP10_COLORS[(finisher.overallRankValue - 1) % TOP10_COLORS.length];
      const athleteRows = clipped
        .filter((row) => row.bib === finisher.bib)
        .sort((left, right) => left.raceDistanceKm - right.raceDistanceKm);

      data.push({
        type: "scatter",
        mode: "lines+markers",
        x: athleteRows.map((row) => row.raceDistanceKm),
        y: athleteRows.map((row) => row.splitRank),
        name: `${finisher.overallRankValue}. ${finisher.name} (#${finisher.bib})`,
        line: { width: 3, color },
        marker: { size: 8, color },
      });
    }
  }

  const tickValues = [
    0.0,
    structure.swimEnd,
    structure.swimEnd + 47.0,
    structure.swimEnd + 90.0,
    structure.swimEnd + 142.0,
    structure.bikeEnd,
    structure.bikeEnd + 20.0,
    finishKm,
  ];
  const tickText = [
    " ",
    "Swim\n3.8 km",
    "Bike\n47",
    "Bike\n90",
    "Bike\n142",
    "Bike\n180 km",
    "Run\n20",
    "Run\n42.2 km",
  ];

  const maxRankTop10 = Math.max(
    10,
    ...clipped
      .filter((row) => finishers.some((finisher) => finisher.bib === row.bib))
      .map((row) => row.splitRank),
  );

  const layout: Partial<Layout> = {
    ...buildSharedLayout(550),
    legend: {
      title: { text: "Athlete", font: { size: 14 } },
      font: { size: 14 },
    },
    xaxis: {
      title: { text: "Race Distance (km)", font: { size: 25 } },
      range: [0, finishKm],
      constrain: "range",
      tickmode: "array",
      tickvals: tickValues,
      ticktext: tickText,
      showgrid: false,
      zeroline: false,
      tickangle: 0,
    },
    yaxis: focusTop10
      ? {
          title: { text: "Rank", font: { size: 25 } },
          autorange: false,
          range: [10.5, 0.5],
          dtick: 1,
          showgrid: true,
          gridcolor: GRID_COLOR,
        }
      : {
          title: { text: "Rank", font: { size: 25 } },
          autorange: false,
          tickmode: "linear",
          tick0: 1,
          dtick: 5,
          range: [maxRankTop10 + 0.5, 0.5],
          showgrid: true,
          gridcolor: GRID_COLOR,
        },
    shapes: [
      {
        type: "line",
        x0: structure.swimEnd,
        x1: structure.swimEnd,
        y0: 0,
        y1: 1,
        xref: "x",
        yref: "paper",
        line: { color: "#AAAAAA", width: 1, dash: "dot" },
      },
      {
        type: "line",
        x0: structure.bikeEnd,
        x1: structure.bikeEnd,
        y0: 0,
        y1: 1,
        xref: "x",
        yref: "paper",
        line: { color: "#AAAAAA", width: 1, dash: "dot" },
      },
    ],
  };

  return { data, layout };
}

function buildAllAthletesFigure(
  rows: RankRow[],
  year: number,
  group: GroupOption,
): PlotFigure | null {
  const structure = raceStructureForYear(year);
  if (!structure) {
    return null;
  }

  const clipped = rows
    .filter((row) => row.raceDistanceKm <= structure.runEnd)
    .sort((left, right) => {
      if (left.bib !== right.bib) {
        return left.bib - right.bib;
      }
      return left.raceDistanceKm - right.raceDistanceKm;
    });

  if (clipped.length === 0) {
    return null;
  }

  const lastRows = new Map<number, RankRow>();
  for (const row of clipped) {
    lastRows.set(row.bib, row);
  }

  const athleteMeta = [...new Map(
    clipped.map((row) => [
      row.bib,
      {
        bib: row.bib,
        name: row.name,
        finishType: row.finishType,
        lastRankAtCutoff: lastRows.get(row.bib)?.splitRank ?? Number.POSITIVE_INFINITY,
      },
    ]),
  ).values()].map((row) => ({
    ...row,
    top10AtCutoff: row.lastRankAtCutoff <= 10,
    color: athleteColor(row.finishType, row.lastRankAtCutoff <= 10),
  }));

  const athletes = athleteMeta
    .filter((row) => athleteInGroup(row.finishType, row.top10AtCutoff, group))
    .sort((left, right) => left.lastRankAtCutoff - right.lastRankAtCutoff);

  if (athletes.length === 0) {
    return null;
  }

  const data: Data[] = athletes.map((athlete) => {
    const athleteRows = clipped
      .filter((row) => row.bib === athlete.bib)
      .sort((left, right) => left.raceDistanceKm - right.raceDistanceKm);
    const label = athlete.name.trim().length > 0 ? `${athlete.name} (#${athlete.bib})` : `#${athlete.bib}`;

    return {
      type: "scatter",
      mode: "lines",
      x: athleteRows.map((row) => row.raceDistanceKm),
      y: athleteRows.map((row) => row.splitRank),
      name: label,
      showlegend: false,
      line: { width: 1.4, color: athlete.color },
      hovertemplate: `${label}<br>km %{x:.1f}<br>rank %{y}<extra></extra>`,
    };
  });

  const tickPairs: Array<[number, string]> = [
    [0.0, "Start"],
    [structure.swimEnd, "Swim 3.8 km"],
    ...structure.extraTicks,
    [structure.bikeEnd, "Bike 180 km"],
    [structure.runEnd, `Run ${structure.runKm} km`],
  ];
  const seen = new Set<number>();
  const tickValues: number[] = [];
  const tickText: string[] = [];

  for (const [value, label] of tickPairs.sort((left, right) => left[0] - right[0])) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    tickValues.push(value);
    tickText.push(label.includes("\n") ? label : label.split(" ").join("\n"));
  }

  const maxRank = Math.max(...clipped.map((row) => row.splitRank));

  const layout: Partial<Layout> = {
    ...buildSharedLayout(650),
    showlegend: false,
    xaxis: {
      title: { text: "Race Distance", font: { size: 25 } },
      tickmode: "array",
      tickvals: tickValues,
      ticktext: tickText,
      showgrid: false,
      zeroline: false,
    },
    yaxis: {
      title: { text: "Rank", font: { size: 25 } },
      autorange: false,
      range: [maxRank + 2, 1],
      tickmode: "linear",
      tick0: 1,
      dtick: 10,
      gridcolor: "#555555",
      zeroline: false,
    },
    shapes: [
      {
        type: "line",
        x0: structure.swimEnd,
        x1: structure.swimEnd,
        y0: 0,
        y1: 1,
        xref: "x",
        yref: "paper",
        line: { color: "#AAAAAA", width: 1, dash: "dot" },
      },
      {
        type: "line",
        x0: structure.bikeEnd,
        x1: structure.bikeEnd,
        y0: 0,
        y1: 1,
        xref: "x",
        yref: "paper",
        line: { color: "#AAAAAA", width: 1, dash: "dot" },
      },
    ],
  };

  return { data, layout };
}

export function buildRankProgressionModel(
  rows: LongRow[],
  selectedYear: number | "All",
  selectedGroup: GroupOption,
  mode: RankMode,
  focusTop10: boolean,
): RankProgressionModel {
  if (selectedYear === "All") {
    return {
      figure: null,
      warning: "Please select a single year to view rank progression.",
      description:
        mode === "Top 10 finishers"
          ? "Top 10 progression follows the final top finishers through the race and can optionally emphasize only the phases where athletes hold a Top 10 rank."
          : "All-athlete progression follows rank over distance up to the Black/White decision cut-off and respects the global group filter.",
    };
  }

  const normalizedRows = normalizeRankRows(rows, selectedYear);
  if (normalizedRows.length === 0) {
    return {
      figure: null,
      warning: `No rank progression data is available for ${selectedYear}.`,
      description:
        mode === "Top 10 finishers"
          ? "Top 10 progression follows the final top finishers through the race and can optionally emphasize only the phases where athletes hold a Top 10 rank."
          : "All-athlete progression follows rank over distance up to the Black/White decision cut-off and respects the global group filter.",
    };
  }

  const figure =
    mode === "Top 10 finishers"
      ? buildTop10Figure(normalizedRows, selectedYear, focusTop10)
      : buildAllAthletesFigure(normalizedRows, selectedYear, selectedGroup);

  if (!figure) {
    return {
      figure: null,
      warning: "The selected rank progression view could not be generated from the packaged split data.",
      description:
        mode === "Top 10 finishers"
          ? "Top 10 progression follows the final top finishers through the race and can optionally emphasize only the phases where athletes hold a Top 10 rank."
          : "All-athlete progression follows rank over distance up to the Black/White decision cut-off and respects the global group filter.",
    };
  }

  const structure = raceStructureForYear(selectedYear);
  const description =
    mode === "Top 10 finishers"
      ? `Top 10 progression for ${selectedYear} uses the finish-distance course view and ignores the global group filter.`
      : `All-athlete progression for ${selectedYear} ends at the ${structure?.runKm ?? "year-specific"} km decision cut-off and currently applies the group filter "${selectedGroup}".`;

  return {
    figure,
    warning: null,
    description,
  };
}
