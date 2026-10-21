import type { Data, Layout } from "plotly.js";

import type { GroupOption } from "@/config/raceRegistry";
import {
  filterRowsByYear,
  isBlackFinishType,
  isDnfFinishType,
  isTop10Rank,
  isWhiteFinishType,
} from "@/lib/groups";
import type { CourseProfileRow, ModelRow } from "@/types/data";

import { PALETTE } from "@/lib/theme";
type PlotFigure = {
  data: Data[];
  layout: Partial<Layout>;
};

type AccuracyRow = {
  splitKey: string;
  raceDistanceKm: number;
  accuracyPct: number;
  nObs: number;
};

export type ModelAccuracyModel = {
  figure: PlotFigure | null;
  warning: string | null;
};

const COURSE_BG = "#7a7a7a";

function isFiniteNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function applyFilters(rows: ModelRow[], year: number | "All", group: GroupOption) {
  return filterRowsByYear(rows, year)
    .filter((row) => row.set === undefined || row.set === "test")
    .filter((row) => {
      if (group === "All") {
        return true;
      }
      if (group === "Top 10") {
        return isTop10Rank(row.split_rank);
      }
      if (group === "Black Shirt") {
        return isBlackFinishType(row.finish_type);
      }
      if (group === "White Shirt") {
        return isWhiteFinishType(row.finish_type);
      }
      if (group === "DNF") {
        return isDnfFinishType(row.finish_type);
      }
      return true;
    });
}

function computeAccuracyByStation(rows: ModelRow[]): AccuracyRow[] {
  const grouped = new Map<string, { splitKey: string; raceDistanceKm: number; correct: number; total: number }>();

  for (const row of rows) {
    if (
      !isFiniteNumber(row.race_distance_km) ||
      !isFiniteNumber(row.y_true) ||
      !isFiniteNumber(row.y_pred)
    ) {
      continue;
    }

    const key = `${row.split_key}:${row.race_distance_km}`;
    const bucket = grouped.get(key) ?? {
      splitKey: row.split_key,
      raceDistanceKm: row.race_distance_km,
      correct: 0,
      total: 0,
    };

    bucket.correct += row.y_true === row.y_pred ? 1 : 0;
    bucket.total += 1;
    grouped.set(key, bucket);
  }

  return [...grouped.values()]
    .filter((row) => row.total > 0)
    .sort((left, right) => left.raceDistanceKm - right.raceDistanceKm)
    .map((row) => ({
      splitKey: row.splitKey,
      raceDistanceKm: row.raceDistanceKm,
      accuracyPct: (row.correct / row.total) * 100,
      nObs: row.total,
    }));
}

function makeSparseTickLabels(rows: AccuracyRow[], minSpacingKm = 6) {
  const tickvals = rows.map((row) => row.raceDistanceKm);
  const ticktext = new Array<string>(tickvals.length).fill("");
  let lastLabeled: number | null = null;

  for (let index = 0; index < rows.length; index += 1) {
    const distance = rows[index].raceDistanceKm;
    if (lastLabeled === null || distance - lastLabeled >= minSpacingKm) {
      ticktext[index] = rows[index].splitKey;
      lastLabeled = distance;
    }
  }

  if (ticktext.length > 0) {
    ticktext[ticktext.length - 1] = rows[rows.length - 1].splitKey;
  }

  return {
    tickvals,
    ticktext,
  };
}

function colorForSlopePct(slopePct: number) {
  // Calm terrain shading so the orange accuracy line stays the focus:
  // blue = descent, white = climb, intensity = gradient.
  if (slopePct <= -4) return "rgba(90, 169, 230, 0.70)";
  if (slopePct <= -1) return "rgba(90, 169, 230, 0.42)";
  if (slopePct < 1) return "rgba(255, 255, 255, 0.12)";
  if (slopePct < 4) return "rgba(255, 255, 255, 0.30)";
  return "rgba(255, 255, 255, 0.52)";
}

function buildGradientElevationTraces(courseRows: CourseProfileRow[]) {
  const rows = courseRows
    .filter(
      (row) =>
        isFiniteNumber(row.distance_km) &&
        isFiniteNumber(row.elev_norseman_m),
    )
    .slice()
    .sort((left, right) => left.distance_km - right.distance_km);

  if (rows.length < 2) {
    return [] as Data[];
  }

  const sampled = new Map<number, { distance_km: number; elev_norseman_m: number }>();
  for (const row of rows) {
    const bucket = Math.round(row.distance_km / 0.5);
    const existing = sampled.get(bucket);
    if (!existing) {
      sampled.set(bucket, {
        distance_km: row.distance_km,
        elev_norseman_m: row.elev_norseman_m!,
      });
    } else {
      sampled.set(bucket, {
        distance_km: (existing.distance_km + row.distance_km) / 2,
        elev_norseman_m: (existing.elev_norseman_m + row.elev_norseman_m!) / 2,
      });
    }
  }

  const simplified = [...sampled.values()].sort((left, right) => left.distance_km - right.distance_km);
  if (simplified.length < 2) {
    return [] as Data[];
  }

  const traces: Data[] = [];
  let blockStart = 0;
  let activeColor: string | null = null;

  function flushBlock(endIndex: number, color: string) {
    traces.push({
      type: "scatter",
      x: simplified.slice(blockStart, endIndex + 1).map((row) => row.distance_km),
      y: simplified.slice(blockStart, endIndex + 1).map((row) => row.elev_norseman_m),
      mode: "lines",
      line: {
        width: 0,
      },
      fill: "tozeroy",
      fillcolor: color,
      showlegend: false,
      hoverinfo: "skip",
      yaxis: "y2",
    } as Data);
  }

  for (let index = 0; index < simplified.length - 1; index += 1) {
    const current = simplified[index];
    const next = simplified[index + 1];
    const dxMeters = (next.distance_km - current.distance_km) * 1000;
    const dyMeters = next.elev_norseman_m - current.elev_norseman_m;
    const slopePct = dxMeters === 0 ? 0 : (dyMeters / dxMeters) * 100;
    const color = colorForSlopePct(slopePct);

    if (activeColor === null) {
      activeColor = color;
      blockStart = index;
      continue;
    }

    if (color !== activeColor) {
      flushBlock(index, activeColor);
      blockStart = index;
      activeColor = color;
    }
  }

  if (activeColor !== null) {
    flushBlock(simplified.length - 1, activeColor);
  }

  traces.push({
    type: "scatter",
    x: rows.map((row) => row.distance_km),
    y: rows.map((row) => row.elev_norseman_m ?? null),
    name: "Norseman elevation",
    mode: "lines",
    line: {
      width: 1.5,
      color: PALETTE.elevationLine,
    },
    hovertemplate: "km %{x:.1f}<br>Elev: %{y:.0f} m<extra></extra>",
    yaxis: "y2",
  } as Data);

  return traces;
}

export function buildModelAccuracyModel(
  modelRows: ModelRow[],
  courseRows: CourseProfileRow[],
  selectedYear: number | "All",
  selectedGroup: GroupOption,
): ModelAccuracyModel {
  const filteredRows = applyFilters(modelRows, selectedYear, selectedGroup);
  const accuracyRows = computeAccuracyByStation(filteredRows);

  if (accuracyRows.length === 0) {
    return {
      figure: null,
      warning: "No model-evaluation data is available for the current year/group filter selection.",
    };
  }

  const tickConfig = makeSparseTickLabels(accuracyRows);
  const courseTraces = buildGradientElevationTraces(courseRows);
  const accuracyMin = Math.max(
    0,
    Math.min(...accuracyRows.map((row) => row.accuracyPct)) - 3,
  );
  const accuracyMax = Math.min(
    100,
    Math.max(...accuracyRows.map((row) => row.accuracyPct)) + 3,
  );
  const xMax = Math.max(
    accuracyRows[accuracyRows.length - 1].raceDistanceKm,
    ...courseRows.map((row) => row.distance_km),
  );

  const figure: PlotFigure = {
    data: [
      ...courseTraces,
      {
        type: "scatter",
        x: accuracyRows.map((row) => row.raceDistanceKm),
        y: accuracyRows.map((row) => row.accuracyPct),
        mode: "lines+markers",
        line: {
          width: 4,
          color: PALETTE.accent,
        },
        marker: {
          size: 8,
          color: PALETTE.accent,
        },
        name: "Model accuracy",
        customdata: accuracyRows.map((row) => [row.splitKey, row.nObs]),
        hovertemplate:
          "Station: %{customdata[0]}<br>" +
          "Distance: %{x:.1f} km<br>" +
          "Accuracy: %{y:.2f}%<br>" +
          "n = %{customdata[1]}<extra></extra>",
      } as Data,
    ],
    layout: {
      height: 740,
      paper_bgcolor: PALETTE.transparent,
      plot_bgcolor: PALETTE.transparent,
      font: { color: "#ffffff" },
      margin: {
        l: 80,
        r: 110,
        t: 30,
        b: 90,
      },
      hovermode: "x unified",
      legend: {
        bgcolor: PALETTE.transparent,
        font: {
          color: "#ffffff",
          size: 13,
        },
        yanchor: "top",
        y: 1,
        xanchor: "left",
        x: 1.02,
        traceorder: "reversed",
      },
      xaxis: {
        title: {
          text: "Distance (km)",
          font: { color: "#ffffff" },
        },
        range: [0, xMax],
        tickmode: "array",
        tickvals: tickConfig.tickvals,
        ticktext: tickConfig.ticktext,
        tickangle: -60,
        ticklabelposition: "outside",
        automargin: true,
        showgrid: false,
        zeroline: false,
        tickfont: { color: "#ffffff" },
      },
      yaxis: {
        title: {
          text: "Model accuracy (%)",
          font: { color: "#ffffff" },
        },
        range: [accuracyMin, accuracyMax],
        tickformat: ".0f",
        showgrid: true,
        gridcolor: "rgba(255,255,255,0.2)",
        zeroline: false,
        tickfont: { color: "#ffffff" },
      },
      yaxis2: {
        title: {
          text: "Elevation (m)",
          font: { color: "#ffffff" },
        },
        overlaying: "y",
        side: "right",
        rangemode: "tozero",
        showgrid: false,
        zeroline: false,
        tickfont: { color: "#ffffff" },
      },
      shapes: accuracyRows.map((row) => ({
        type: "line",
        xref: "x",
        yref: "paper",
        x0: row.raceDistanceKm,
        x1: row.raceDistanceKm,
        y0: 0,
        y1: 1,
        line: {
          color: "rgba(255,255,255,0.25)",
          dash: "dash",
          width: 1,
        },
        layer: "below",
      })),
    },
  };

  return {
    figure,
    warning:
      selectedGroup === "Top 10"
        ? "Top 10 is evaluated by split rank at each station."
        : null,
  };
}
