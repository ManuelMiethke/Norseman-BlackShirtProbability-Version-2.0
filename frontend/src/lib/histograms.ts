import type { Data, Layout } from "plotly.js";

import { filterRowsByGroup, filterRowsByYear, isBlackFinishType, isDnfFinishType, isWhiteFinishType } from "@/lib/groups";
import { secondsToPaddedHms, timeToSeconds } from "@/lib/time";
import type { WideRow } from "@/types/data";
import type { GroupOption } from "@/config/raceRegistry";

const BACKGROUND = "rgba(0,0,0,0)";
const TOP10_COLOR = "lightgreen";

export type HistogramScaleMode =
  | "Absolute (hh:mm:ss)"
  | "Relative (% vs median)"
  | "Bike-Time scale (min swim → 10h)";

type HistogramFigure = {
  key: string;
  data: Data[];
  layout: Partial<Layout>;
};

export type HistogramModel = {
  figures: HistogramFigure[];
  warning: string | null;
};

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function formatHms(seconds: number): string {
  return secondsToPaddedHms(seconds) || "";
}

function toHistogramEdges(minValue: number, maxValue: number, bins: number): number[] {
  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue) || maxValue <= minValue) {
    return [];
  }

  const edges: number[] = [];
  const width = (maxValue - minValue) / bins;
  for (let index = 0; index <= bins; index += 1) {
    edges.push(minValue + width * index);
  }
  return edges;
}

function histogramCounts(values: number[], edges: number[]) {
  const counts = new Array(Math.max(edges.length - 1, 0)).fill(0);
  if (edges.length < 2) {
    return counts;
  }

  for (const value of values) {
    if (!Number.isFinite(value) || value < edges[0] || value > edges[edges.length - 1]) {
      continue;
    }

    if (value === edges[edges.length - 1]) {
      counts[counts.length - 1] += 1;
      continue;
    }

    const width = edges[1] - edges[0];
    const index = Math.min(
      counts.length - 1,
      Math.max(0, Math.floor((value - edges[0]) / width)),
    );
    counts[index] += 1;
  }

  return counts;
}

function buildRoundedTicks(secMin: number, secMax: number) {
  if (!Number.isFinite(secMin) || !Number.isFinite(secMax) || secMax <= secMin) {
    return null;
  }

  const minMinutes = secMin / 60;
  const maxMinutes = secMax / 60;
  const span = maxMinutes - minMinutes;

  let step = 5;
  if (span > 240) {
    step = 30;
  } else if (span > 120) {
    step = 20;
  } else if (span > 60) {
    step = 10;
  }

  const start = Math.floor(minMinutes / step) * step;
  const end = Math.ceil(maxMinutes / step) * step;

  const tickvals: number[] = [];
  const ticktext: string[] = [];
  for (let value = start; value <= end + 1e-9; value += step) {
    const seconds = value * 60;
    tickvals.push(seconds);
    ticktext.push(formatHms(seconds));
  }

  return { tickvals, ticktext };
}

function rowTimeSeconds(
  row: WideRow,
  metric: "swim" | "bike" | "runToCutoff" | "totalToCutoff",
): number | null {
  if (metric === "swim") {
    return timeToSeconds(row.swim_time ?? null);
  }

  if (metric === "bike") {
    return timeToSeconds(row.bike_time ?? null);
  }

  const runStart = timeToSeconds(row.run_start_time ?? null);
  const cutoff =
    Number(row.year) <= 2022
      ? timeToSeconds(row.run_32_5km_langefonn_time ?? null)
      : timeToSeconds(row.run_37_5km_stavsro_cut_off_time ?? null);

  if (metric === "totalToCutoff") {
    return cutoff;
  }

  if (runStart === null || cutoff === null) {
    return null;
  }

  const delta = cutoff - runStart;
  return delta > 0 ? delta : null;
}

function dedupeRows(rows: WideRow[]) {
  const unique = new Map<string, WideRow>();
  for (const row of rows) {
    unique.set(`${row.year}:${row.bib}`, row);
  }
  return [...unique.values()];
}

function buildReferenceRange(rows: WideRow[]) {
  const swimValues = rows
    .map((row) => timeToSeconds(row.swim_time ?? null))
    .filter((value): value is number => value !== null);
  const bikeValues = rows
    .map((row) => timeToSeconds(row.bike_time ?? null))
    .filter((value): value is number => value !== null);

  if (swimValues.length === 0) {
    return null;
  }

  const swimMin = Math.min(...swimValues);
  const bikeMax = bikeValues.length > 0 ? Math.max(...bikeValues) : null;
  const upper = Math.max(10 * 3600, bikeMax ?? 10 * 3600);

  if (!Number.isFinite(swimMin) || upper <= swimMin) {
    return null;
  }

  const padding = (upper - swimMin) * 0.02;
  return [Math.max(0, swimMin - padding), upper + padding] as const;
}

function traceGroupRows(rows: WideRow[]) {
  const top10Rows = rows.filter((row) => Number(row.overall_rank ?? Number.NaN) <= 10);
  const top10Set = new Set(top10Rows.map((row) => `${row.year}:${row.bib}`));

  return {
    baseBlack: rows.filter((row) => isBlackFinishType(row.finish_type) && !top10Set.has(`${row.year}:${row.bib}`)),
    baseWhite: rows.filter((row) => isWhiteFinishType(row.finish_type) && !top10Set.has(`${row.year}:${row.bib}`)),
    baseDnf: rows.filter((row) => isDnfFinishType(row.finish_type) && !top10Set.has(`${row.year}:${row.bib}`)),
    top10: top10Rows,
  };
}

function buildHistogramFigure(
  rows: WideRow[],
  metric: "swim" | "bike" | "runToCutoff" | "totalToCutoff",
  title: string,
  scaleMode: HistogramScaleMode,
  referenceRange: readonly [number, number] | null,
): HistogramFigure | null {
  const withSeconds = rows
    .map((row) => ({
      row,
      seconds: rowTimeSeconds(row, metric),
    }))
    .filter((entry): entry is { row: WideRow; seconds: number } => entry.seconds !== null);

  if (withSeconds.length === 0) {
    return null;
  }

  const allSeconds = withSeconds.map((entry) => entry.seconds);
  const medianSeconds = median(allSeconds);
  if (medianSeconds === null) {
    return null;
  }

  const traces = traceGroupRows(withSeconds.map((entry) => entry.row));
  const data: Data[] = [];

  const chartRows = [
    { key: "Black", rows: traces.baseBlack, color: "black", bins: 40, opacity: 0.7 },
    { key: "White", rows: traces.baseWhite, color: "white", bins: 40, opacity: 0.7 },
    { key: "DNF", rows: traces.baseDnf, color: "red", bins: 80, opacity: 0.65 },
    { key: "Top 10", rows: traces.top10, color: TOP10_COLOR, bins: 40, opacity: 0.79 },
  ];

  const transformedAll = withSeconds
    .map((entry) =>
      scaleMode === "Relative (% vs median)"
        ? (entry.seconds - medianSeconds) / medianSeconds
        : entry.seconds,
    )
    .filter((value) => Number.isFinite(value));

  const globalEdges =
    scaleMode === "Relative (% vs median)"
      ? toHistogramEdges(Math.min(...transformedAll), Math.max(...transformedAll), 40)
      : scaleMode === "Bike-Time scale (min swim → 10h)" && referenceRange
        ? toHistogramEdges(referenceRange[0], referenceRange[1], 40)
        : null;

  for (const trace of chartRows) {
    const seconds = trace.rows
      .map((row) => rowTimeSeconds(row, metric))
      .filter((value): value is number => value !== null);

    if (seconds.length === 0) {
      continue;
    }

    const values =
      scaleMode === "Relative (% vs median)"
        ? seconds.map((value) => (value - medianSeconds) / medianSeconds)
        : seconds;

    const edges =
      globalEdges && globalEdges.length > 1
        ? globalEdges
        : toHistogramEdges(Math.min(...values), Math.max(...values), trace.bins);

    if (edges.length < 2) {
      continue;
    }

    const centers = edges.slice(0, -1).map((edge, index) => (edge + edges[index + 1]) / 2);
    const width = edges[1] - edges[0];
    const counts = histogramCounts(values, edges);

    const hovertext = counts.map((count, index) => {
      const left = edges[index];
      const right = edges[index + 1];
      if (scaleMode === "Relative (% vs median)") {
        return `${trace.key}<br>${(left * 100).toFixed(0)}% – ${(right * 100).toFixed(0)}%<br>n=${count}`;
      }
      return `${trace.key}<br>${formatHms(left)} – ${formatHms(right)}<br>n=${count}`;
    });

    data.push({
      type: "bar",
      x: centers,
      y: counts,
      width,
      name: trace.key,
      opacity: trace.opacity,
      marker: {
        color: trace.color,
        line: trace.color === "white" ? { color: "#888888", width: 1 } : undefined,
      },
      hovertext,
      hoverinfo: "text",
    });
  }

  const xAxisTitle =
    scaleMode === "Relative (% vs median)"
      ? "Relative time vs median (%)"
      : scaleMode === "Bike-Time scale (min swim → 10h)"
        ? "Time (hh:mm:ss) — Bike-Time scale"
        : "Time (hh:mm:ss)";

  const tickSpec =
    scaleMode === "Relative (% vs median)"
      ? null
      : scaleMode === "Bike-Time scale (min swim → 10h)" && referenceRange
        ? buildRoundedTicks(referenceRange[0], referenceRange[1])
        : buildRoundedTicks(Math.min(...allSeconds), Math.max(...allSeconds));

  return {
    key: `${metric}:${scaleMode}`,
    data,
    layout: {
      paper_bgcolor: BACKGROUND,
      plot_bgcolor: BACKGROUND,
      font: { color: "#eef5fb", family: "IBM Plex Sans, sans-serif" },
      margin: { l: 10, r: 10, t: 90, b: 10 },
      title: { text: title, y: 0.92, x: 0.01, xanchor: "left" },
      barmode: "overlay",
      legend: {
        y: 1.22,
        x: 0.99,
        xanchor: "right",
        yanchor: "top",
      },
      xaxis: {
        title: { text: xAxisTitle, font: { size: 14, color: "#ffffff" } },
        tickfont: { size: 12, color: "#ffffff" },
        gridcolor: "#c7c7c7",
        zerolinecolor: "#c7c7c7",
        tickmode: tickSpec ? "array" : "auto",
        tickvals: tickSpec?.tickvals,
        ticktext: tickSpec?.ticktext,
        tickformat: scaleMode === "Relative (% vs median)" ? ".0%" : undefined,
        range: scaleMode === "Bike-Time scale (min swim → 10h)" && referenceRange ? [...referenceRange] : undefined,
      },
      yaxis: {
        title: { text: "Frequency", font: { size: 14, color: "#ffffff" } },
        tickfont: { size: 12, color: "#ffffff" },
        gridcolor: "#c7c7c7",
        zerolinecolor: "#c7c7c7",
      },
      shapes:
        scaleMode === "Relative (% vs median)"
          ? [
              {
                type: "line",
                x0: 0,
                x1: 0,
                y0: 0,
                y1: 1,
                xref: "x",
                yref: "paper",
                line: {
                  color: "orange",
                  width: 2,
                  dash: "dot",
                },
              },
            ]
          : undefined,
      annotations:
        scaleMode === "Relative (% vs median)"
          ? [
              {
                text: "Median",
                x: 0,
                y: 1,
                xref: "x",
                yref: "paper",
                showarrow: false,
                font: { color: "orange", size: 12 },
                yshift: 12,
              },
            ]
          : undefined,
    },
  };
}

export function buildHistogramModel(
  rows: WideRow[],
  selectedYear: number | "All",
  selectedGroup: GroupOption,
  scaleMode: HistogramScaleMode,
): HistogramModel {
  const yearRows = filterRowsByYear(rows, selectedYear);
  const filteredRows = dedupeRows(filterRowsByGroup(yearRows, selectedGroup));

  if (filteredRows.length === 0) {
    return {
      figures: [],
      warning: "No data is available for the selected year and group.",
    };
  }

  const referenceRange =
    scaleMode === "Bike-Time scale (min swim → 10h)" ? buildReferenceRange(filteredRows) : null;

  const figures = [
    buildHistogramFigure(filteredRows, "swim", "Swim Time", scaleMode, referenceRange),
    buildHistogramFigure(filteredRows, "bike", "Bike Time", scaleMode, referenceRange),
    buildHistogramFigure(filteredRows, "runToCutoff", "Run Time (to cut-off)", scaleMode, referenceRange),
    buildHistogramFigure(filteredRows, "totalToCutoff", "Time to cut-off", scaleMode, referenceRange),
  ].filter((figure): figure is HistogramFigure => figure !== null);

  if (figures.length === 0) {
    return {
      figures: [],
      warning: "The current selection does not contain usable timing values for the distribution charts.",
    };
  }

  return {
    figures,
    warning: null,
  };
}
