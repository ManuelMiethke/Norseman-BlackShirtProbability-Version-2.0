import type { Data, Layout } from "plotly.js";

import { RANK_BAND_GROUP, type GroupOption } from "@/config/raceRegistry";
import {
  athleteKey,
  classifyFinishGroup,
  filterRowsByYear,
  isTop10Rank,
  isInRankBand,
} from "@/lib/groups";
import type { ModelRow } from "@/types/data";

import { PALETTE } from "@/lib/theme";
type PlotFigure = {
  data: Data[];
  layout: Partial<Layout>;
};

type ProbabilitySurfaceMode = "2d" | "3d";

type ProbabilityMarker = {
  name: string;
  distanceTotalKm: number;
  splitLabel: string;
  symbol: "circle" | "x";
};

export type ProbabilitySurfaceModel = {
  figure: PlotFigure | null;
  markerSummaries: string[];
  warning: string | null;
};

const SWIM_KM = 3.8;
const BIKE_KM = 180.0;
const RUN_KM = 42.2;
const PROB_TRANSITION_MIN = 0.1;
const PROB_TRANSITION_MAX = 0.9;
const PANEL_BG = "rgba(0,0,0,0)";
const TEXT_COLOR = "#eef5fb";

const PROBABILITY_COLORSCALE: Array<[number, string]> = [
  [0.0, "#ffffff"],
  [0.2, "#f2f2f2"],
  [0.4, "#d9d9d9"],
  [0.5, "#bfbfbf"],
  [0.65, "#8c8c8c"],
  [0.8, "#4d4d4d"],
  [1.0, "#000000"],
];

function isFiniteNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function formatKm(value: number) {
  return Math.abs(value - Math.round(value)) < 1e-9 ? `${Math.round(value)}` : value.toFixed(1);
}

function formatSplitDistanceLabel(cumulativeKm: number) {
  const bikeStart = SWIM_KM;
  const runStart = SWIM_KM + BIKE_KM;
  if (cumulativeKm < bikeStart) {
    return `${formatKm(cumulativeKm)} km S`;
  }
  if (cumulativeKm <= runStart) {
    return `${formatKm(cumulativeKm - bikeStart)} km B`;
  }
  return `${formatKm(cumulativeKm - runStart)} km R`;
}

function buildSplitAxisTicks(xValues: number[]) {
  if (xValues.length === 0) {
    return { tickValues: [] as number[], tickText: [] as string[] };
  }

  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const bikeStart = SWIM_KM;
  const runStart = SWIM_KM + BIKE_KM;
  const bikeKmCandidates = [0, 30, 60, 90, 120, 150, 180];
  const runKmCandidates = [0, 5, 10, 15, 20, 25, 30, 32.5, 37.5, 40, 42.2];
  const ticks: Array<[number, string]> = [];

  for (const distance of bikeKmCandidates) {
    const x = bikeStart + distance;
    if (x >= xMin && x <= xMax) {
      ticks.push([x, `${formatKm(distance)} km B`]);
    }
  }
  for (const distance of runKmCandidates) {
    const x = runStart + distance;
    if (x >= xMin && x <= xMax) {
      ticks.push([x, `${formatKm(distance)} km R`]);
    }
  }

  const tickValues: number[] = [];
  const tickText: string[] = [];
  for (const [value, label] of ticks.sort((left, right) => left[0] - right[0])) {
    if (tickValues.length > 0 && Math.abs(value - tickValues[tickValues.length - 1]) < 1e-9) {
      continue;
    }
    tickValues.push(value);
    tickText.push(label);
  }
  return { tickValues, tickText };
}

function filterModelRowsByGroup(rows: ModelRow[], selectedGroup: GroupOption) {
  if (selectedGroup === "All") {
    return rows;
  }
  if (selectedGroup === "Black Shirt") {
    return rows.filter((row) => {
      const group = classifyFinishGroup({ finish_type: row.finish_type, overall_rank: row.split_rank });
      return group === "Black Shirt" || group === "Top 10";
    });
  }
  if (selectedGroup === "White Shirt") {
    return rows.filter((row) => classifyFinishGroup({ finish_type: row.finish_type, overall_rank: row.split_rank }) === "White Shirt");
  }
  if (selectedGroup === "DNF") {
    return rows.filter((row) => classifyFinishGroup({ finish_type: row.finish_type, overall_rank: row.split_rank }) === "DNF");
  }

  const latestByAthlete = new Map<string, ModelRow>();
  for (const row of rows) {
    const key = athleteKey(row);
    const current = latestByAthlete.get(key);
    const currentDistance = current?.race_distance_km ?? Number.NEGATIVE_INFINITY;
    if ((row.race_distance_km ?? Number.NEGATIVE_INFINITY) >= currentDistance) {
      latestByAthlete.set(key, row);
    }
  }
  const inGroup = selectedGroup === RANK_BAND_GROUP ? isInRankBand : isTop10Rank;
  const top10Athletes = new Set(
    [...latestByAthlete.entries()]
      .filter(([, row]) => inGroup(row.split_rank))
      .map(([key]) => key),
  );
  return rows.filter((row) => top10Athletes.has(athleteKey(row)));
}

function interpolateSeries(values: Array<number | null>) {
  const output = [...values];
  let lastKnown = -1;
  for (let index = 0; index < output.length; index += 1) {
    if (isFiniteNumber(output[index])) {
      if (lastKnown >= 0 && lastKnown + 1 < index) {
        const start = output[lastKnown] as number;
        const end = output[index] as number;
        const span = index - lastKnown;
        for (let fillIndex = lastKnown + 1; fillIndex < index; fillIndex += 1) {
          output[fillIndex] = start + ((end - start) * (fillIndex - lastKnown)) / span;
        }
      }
      lastKnown = index;
    }
  }

  for (let index = 0; index < output.length; index += 1) {
    if (isFiniteNumber(output[index])) {
      for (let backfill = index - 1; backfill >= 0 && !isFiniteNumber(output[backfill]); backfill -= 1) {
        output[backfill] = output[index];
      }
      break;
    }
  }

  for (let index = output.length - 1; index >= 0; index -= 1) {
    if (isFiniteNumber(output[index])) {
      for (let fillIndex = index + 1; fillIndex < output.length && !isFiniteNumber(output[fillIndex]); fillIndex += 1) {
        output[fillIndex] = output[index];
      }
      break;
    }
  }

  return output;
}

function buildSurfaceGrid(rows: ModelRow[]) {
  const validRows = rows.filter(
    (row) =>
      isFiniteNumber(row.race_distance_km) &&
      isFiniteNumber(row.cum_time_seconds) &&
      isFiniteNumber(row.p_black),
  );

  if (validRows.length === 0) {
    return null;
  }

  const timeStepHours = 0.25;
  const aggregated = new Map<string, { sum: number; count: number }>();
  const xSet = new Set<number>();
  const ySet = new Set<number>();

  for (const row of validRows) {
    const distanceBin = Number(Number(row.race_distance_km).toFixed(1));
    const timeHours = Number(row.cum_time_seconds) / 3600;
    const timeBin = Math.round(timeHours / timeStepHours) * timeStepHours;
    const key = `${timeBin}:${distanceBin}`;
    const current = aggregated.get(key) ?? { sum: 0, count: 0 };
    current.sum += Number(row.p_black);
    current.count += 1;
    aggregated.set(key, current);
    xSet.add(distanceBin);
    ySet.add(timeBin);
  }

  const xValues = [...xSet].sort((left, right) => left - right);
  const yValues = [...ySet].sort((left, right) => left - right);
  if (xValues.length === 0 || yValues.length === 0) {
    return null;
  }

  let matrix: Array<Array<number | null>> = yValues.map((timeBin) =>
    xValues.map((distanceBin) => {
      const key = `${timeBin}:${distanceBin}`;
      const entry = aggregated.get(key);
      return entry ? Math.min(1, Math.max(0, entry.sum / entry.count)) : null;
    }),
  );

  matrix = matrix.map((row) => interpolateSeries(row));
  for (let columnIndex = 0; columnIndex < xValues.length; columnIndex += 1) {
    const column = interpolateSeries(matrix.map((row) => row[columnIndex]));
    for (let rowIndex = 0; rowIndex < yValues.length; rowIndex += 1) {
      matrix[rowIndex][columnIndex] = column[rowIndex];
    }
  }

  if (matrix.every((row) => row.every((value) => !isFiniteNumber(value)))) {
    return null;
  }

  return {
    xValues,
    yValues,
    zValues: matrix.map((row) => row.map((value) => value ?? 0)),
  };
}

export function parseHhMmToHours(text: string) {
  const value = text.trim();
  if (!value) {
    return null;
  }
  const [hours, minutes, extra] = value.split(":");
  if (extra !== undefined) {
    return null;
  }
  const hoursNumber = Number(hours);
  const minutesNumber = Number(minutes);
  if (!Number.isInteger(hoursNumber) || !Number.isInteger(minutesNumber) || minutesNumber < 0 || minutesNumber > 59 || hoursNumber < 0) {
    return null;
  }
  return hoursNumber + minutesNumber / 60;
}

export function parseOptionalKm(text: string, maxKm: number) {
  const value = text.trim().replace(",", ".");
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > maxKm) {
    return null;
  }
  return parsed;
}

function interpolateSurfaceProbability(xValues: number[], yValues: number[], zValues: number[][], xKm: number, yHours: number) {
  const xClamped = Math.min(Math.max(xKm, xValues[0]), xValues[xValues.length - 1]);
  const yClamped = Math.min(Math.max(yHours, yValues[0]), yValues[yValues.length - 1]);
  const zOverX = zValues.map((row) => {
    let index = 0;
    while (index < xValues.length - 1 && xValues[index + 1] < xClamped) {
      index += 1;
    }
    const leftX = xValues[index];
    const rightX = xValues[Math.min(index + 1, xValues.length - 1)];
    const leftZ = row[index];
    const rightZ = row[Math.min(index + 1, row.length - 1)];
    if (Math.abs(rightX - leftX) < 1e-9) {
      return leftZ;
    }
    return leftZ + ((rightZ - leftZ) * (xClamped - leftX)) / (rightX - leftX);
  });

  let index = 0;
  while (index < yValues.length - 1 && yValues[index + 1] < yClamped) {
    index += 1;
  }
  const leftY = yValues[index];
  const rightY = yValues[Math.min(index + 1, yValues.length - 1)];
  const leftZ = zOverX[index];
  const rightZ = zOverX[Math.min(index + 1, zOverX.length - 1)];
  if (Math.abs(rightY - leftY) < 1e-9) {
    return Math.min(1, Math.max(0, leftZ));
  }
  return Math.min(1, Math.max(0, leftZ + ((rightZ - leftZ) * (yClamped - leftY)) / (rightY - leftY)));
}

function buildMarkerSummary(marker: ProbabilityMarker, probability: number, timeHours: number, clipped: boolean) {
  return `${marker.name}: ${marker.splitLabel} @ ${timeHours.toFixed(2)} h -> P(Black) ~ ${(probability * 100).toFixed(1)}%${clipped ? " (clipped to data range)" : ""}`;
}

function build2dFigure(
  xValues: number[],
  yValues: number[],
  zValues: number[][],
  markers: ProbabilityMarker[],
  timeHours: number | null,
) {
  const transitionRows = yValues
    .map((_, rowIndex) => zValues[rowIndex].some((value) => value > PROB_TRANSITION_MIN && value < PROB_TRANSITION_MAX))
    .flatMap((hasTransition, rowIndex) => (hasTransition ? [rowIndex] : []));
  const rowStart = transitionRows.length > 0 ? Math.max(transitionRows[0] - 1, 0) : 0;
  const rowEnd = transitionRows.length > 0 ? Math.min(transitionRows[transitionRows.length - 1] + 1, yValues.length - 1) : yValues.length - 1;
  const yPlot = yValues.slice(rowStart, rowEnd + 1);
  const zPlot = zValues.slice(rowStart, rowEnd + 1);
  const splitLabels = xValues.map((value) => formatSplitDistanceLabel(value));
  const tick = buildSplitAxisTicks(xValues);
  const data: Data[] = [
    {
      type: "contour",
      x: xValues,
      y: yPlot,
      z: zPlot,
      zmin: 0,
      zmax: 1,
      colorscale: PROBABILITY_COLORSCALE,
      customdata: yPlot.map(() => splitLabels),
      colorbar: { title: { text: "P(Black Shirt)", side: "right" }, tickformat: ".0%", thickness: 12, len: 0.9, outlinewidth: 0 },
      contours: {
        coloring: "heatmap",
        showlines: false,
        start: 0,
        end: 1,
        size: 0.02,
      },
      connectgaps: true,
      hovertemplate: "Distance: %{customdata}<br>Time: %{y:.2f} h<br>P(Black): %{z:.1%}<extra></extra>",
    },
  ];

  const markerSummaries: string[] = [];
  if (timeHours !== null) {
    for (const marker of markers) {
      const probability = interpolateSurfaceProbability(xValues, yValues, zValues, marker.distanceTotalKm, timeHours);
      const clipped =
        marker.distanceTotalKm < xValues[0] ||
        marker.distanceTotalKm > xValues[xValues.length - 1] ||
        timeHours < yValues[0] ||
        timeHours > yValues[yValues.length - 1];
      data.push({
        type: "scatter",
        x: [marker.distanceTotalKm],
        y: [timeHours],
        mode: "markers",
        name: marker.name,
        marker: {
          size: 10,
          color: PALETTE.accent,
          symbol: marker.symbol === "x" ? "x" : "circle",
          line: { color: "#111111", width: 1 },
        },
        hovertemplate: `${marker.name}<br>Distance: ${marker.splitLabel}<br>Time: %{y:.2f} h<br>P(Black): ${(probability * 100).toFixed(1)}%<extra></extra>`,
        showlegend: true,
      });
      markerSummaries.push(buildMarkerSummary(marker, probability, timeHours, clipped));
    }
  }

  return {
    figure: {
      data,
      layout: {
        paper_bgcolor: PANEL_BG,
        plot_bgcolor: PANEL_BG,
        font: { color: TEXT_COLOR, family: "IBM Plex Sans, sans-serif" },
        margin: { l: 10, r: 10, t: 10, b: 40 },
        xaxis: {
          title: { text: "Split distance (Bike / Run)" },
          tickmode: "array" as const,
          tickvals: tick.tickValues,
          ticktext: tick.tickText,
          gridcolor: "rgba(255,255,255,0.18)",
        },
        yaxis: {
          title: { text: "Cumulative time (h)" },
          gridcolor: "rgba(255,255,255,0.18)",
        },
      },
    },
    markerSummaries,
  };
}

function build3dFigure(
  xValues: number[],
  yValues: number[],
  zValues: number[][],
  markers: ProbabilityMarker[],
  timeHours: number | null,
) {
  const splitLabels = xValues.map((value) => formatSplitDistanceLabel(value));
  const tick = buildSplitAxisTicks(xValues);
  const data: Data[] = [
    {
      type: "surface",
      x: xValues,
      y: yValues,
      z: zValues,
      surfacecolor: zValues,
      cmin: 0,
      cmax: 1,
      colorscale: PROBABILITY_COLORSCALE,
      customdata: yValues.map(() => splitLabels),
      colorbar: { title: { text: "P(Black Shirt)", side: "right" }, tickformat: ".0%", thickness: 12, len: 0.9, outlinewidth: 0 },
      hovertemplate: "Distance: %{customdata}<br>Time: %{y:.2f} h<br>P(Black): %{z:.1%}<extra></extra>",
      opacity: 0.98,
    } as Data,
  ];

  const markerSummaries: string[] = [];
  if (timeHours !== null) {
    for (const marker of markers) {
      const probability = interpolateSurfaceProbability(xValues, yValues, zValues, marker.distanceTotalKm, timeHours);
      const clipped =
        marker.distanceTotalKm < xValues[0] ||
        marker.distanceTotalKm > xValues[xValues.length - 1] ||
        timeHours < yValues[0] ||
        timeHours > yValues[yValues.length - 1];
      data.push({
        type: "scatter3d",
        x: [marker.distanceTotalKm],
        y: [timeHours],
        z: [probability],
        mode: "markers",
        name: marker.name,
        marker: {
          size: 9,
          color: PALETTE.accent,
          symbol: marker.symbol,
          line: { color: "#111111", width: 1 },
        },
        hovertemplate: `${marker.name}<br>Distance: ${marker.splitLabel}<br>Time: %{y:.2f} h<br>P(Black): %{z:.1%}<extra></extra>`,
        showlegend: true,
      });
      markerSummaries.push(buildMarkerSummary(marker, probability, timeHours, clipped));
    }
  }

  return {
    figure: {
      data,
      layout: {
        paper_bgcolor: PANEL_BG,
        plot_bgcolor: PANEL_BG,
        font: { color: TEXT_COLOR, family: "IBM Plex Sans, sans-serif" },
        margin: { l: 0, r: 0, t: 10, b: 0 },
        scene: {
          bgcolor: PANEL_BG,
          camera: { eye: { x: 1.3, y: 1.15, z: 0.75 } },
          xaxis: {
            title: { text: "Split distance (Bike / Run)" },
            tickmode: "array" as const,
            tickvals: tick.tickValues,
            ticktext: tick.tickText,
            gridcolor: "rgba(255,255,255,0.18)",
          },
          yaxis: {
            title: { text: "Cumulative time (h)" },
            gridcolor: "rgba(255,255,255,0.18)",
          },
          zaxis: {
            title: { text: "P(Black Shirt)" },
            range: [0, 1],
            tickformat: ".0%",
            gridcolor: "rgba(255,255,255,0.18)",
          },
        },
      },
    },
    markerSummaries,
  };
}

export function buildProbabilityMarkers(bikeKm: number | null, runKm: number | null) {
  const markers: ProbabilityMarker[] = [];
  if (bikeKm !== null) {
    markers.push({
      name: "Bike checkpoint",
      symbol: "circle",
      distanceTotalKm: SWIM_KM + bikeKm,
      splitLabel: `${formatKm(bikeKm)} km B`,
    });
  }
  if (runKm !== null) {
    markers.push({
      name: "Run checkpoint",
      symbol: "x",
      distanceTotalKm: SWIM_KM + BIKE_KM + runKm,
      splitLabel: `${formatKm(runKm)} km R`,
    });
  }
  return markers;
}

export function buildProbabilitySurfaceModel(
  modelRows: ModelRow[],
  selectedYear: number | "All",
  selectedGroup: GroupOption,
  mode: ProbabilitySurfaceMode,
  markers: ProbabilityMarker[],
  timeHours: number | null,
): ProbabilitySurfaceModel {
  const filteredRows = filterModelRowsByGroup(
    filterRowsByYear(modelRows, selectedYear).filter(
      (row) =>
        (row.set === undefined || row.set === "test") &&
        isFiniteNumber(row.race_distance_km) &&
        isFiniteNumber(row.cum_time_seconds) &&
        isFiniteNumber(row.p_black),
    ),
    selectedGroup,
  );

  if (filteredRows.length === 0) {
    return {
      figure: null,
      markerSummaries: [],
      warning: "No probability surface data is available for the current filters.",
    };
  }

  const surface = buildSurfaceGrid(filteredRows);
  if (!surface) {
    return {
      figure: null,
      markerSummaries: [],
      warning: "Could not build a stable probability surface for the current filters.",
    };
  }

  const built =
    mode === "2d"
      ? build2dFigure(surface.xValues, surface.yValues, surface.zValues, markers, timeHours)
      : build3dFigure(surface.xValues, surface.yValues, surface.zValues, markers, timeHours);

  return {
    figure: built.figure,
    markerSummaries: built.markerSummaries,
    warning: null,
  };
}
