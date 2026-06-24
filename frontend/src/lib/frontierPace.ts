import type { Data, Layout } from "plotly.js";

import type { GroupOption } from "@/config/raceRegistry";
import { athleteKey, classifyFinishGroup, filterRowsByYear, isBlackFinishType, isDnfFinishType, isTop10Rank, isWhiteFinishType } from "@/lib/groups";
import type { CourseProfileRow, LongRow, ModelRow } from "@/types/data";

type PlotFigure = {
  data: Data[];
  layout: Partial<Layout>;
};

type FrontierMode = "absolute" | "relative";

type FrontierPoint = {
  splitKey: string;
  raceDistanceKm: number;
  cumTimeSeconds: number;
  frontierProbability: number;
  frontierMethod: "interpolated" | "nearest";
  segmentDistanceKm: number | null;
  segmentTimeSeconds: number | null;
  segmentSpeedKmh: number | null;
  leg: "swim" | "bike" | "run" | "transition" | "other";
};

type FrontierTableRow = {
  splitKey: string;
  distanceKm: string;
  segmentTime: string;
  cumulativeTime: string;
  frontierSpeedKmh: string;
};

type RelativePoint = {
  bib: number;
  label: string;
  groupLabel: "Top 10" | "Black Shirt" | "White Shirt" | "DNF" | "Other";
  distanceKm: number;
  deltaHours: number;
};

type AbsoluteAccumulatedRow = {
  athleteId: string;
  category: "Top10" | "Black" | "White" | "DNF" | "Other";
  xPlot: number;
  cumTimeHours: number;
};

export type FrontierPaceModel = {
  accumulatedFigure: PlotFigure | null;
  chartFigure: PlotFigure | null;
  tableRows: FrontierTableRow[];
  totalTimeLabel: string | null;
  warning: string | null;
};

const TARGET_PROB = 0.5;
const SWIM_KM = 3.8;
const BIKE_KM = 180.0;
const RUN_KM = 42.2;
const ACCUMULATED_GAP_KM = 6.0;
const GRID_COLOR = "rgba(255,255,255,0.22)";
const TEXT_COLOR = "#eef5fb";
const PANEL_BG = "rgba(0,0,0,0)";
const FRONTIER_COLOR = "#ff8c00";

const ORDERED_SPLIT_KEYS = [
  "swim_finish",
  "transition_1_in",
  "bike_start",
  "bike_6km_ovre_eidfjord",
  "bike_11km_enter_gamlevegen",
  "bike_16km_voringfossen",
  "bike_20km_garen",
  "bike_28km_bjoreio",
  "bike_36km_dyranut",
  "bike_47km_halne",
  "bike_66km_haugastol",
  "bike_90km_geilo",
  "bike_94km_kikut",
  "bike_101km_skurdalen",
  "bike_113km_dagali",
  "bike_123km_vasstulan",
  "bike_134km_start_imingfjell",
  "bike_142km_top_imingfjell",
  "bike_152km_end_imingfjell",
  "bike_180km_finish",
  "run_start",
  "run_5km_atraa",
  "run_10km",
  "run_15km_tinnsjo",
  "run_20km_miland",
  "run_25km_zombie_hill_base",
  "run_zombie_hill_1st_turn",
  "run_zombie_hill_2nd_turn",
  "run_zombie_hill_3rd_turn",
  "run_zombie_hill_4th_turn",
  "run_zombie_hill_5th_turn",
  "run_32_5km_langefonn",
  "run_37_5km_stavsro_cut_off",
] as const;

function isFiniteNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function formatHms(seconds: number | null | undefined) {
  if (!isFiniteNumber(seconds)) {
    return "—";
  }

  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function cutoffTotalKmForYear(selectedYear: number | "All", maxDistanceKm: number) {
  if (selectedYear === "All") {
    return maxDistanceKm;
  }
  return selectedYear >= 2024 ? 221.3 : 216.3;
}

function inferLeg(splitKey: string): FrontierPoint["leg"] {
  if (splitKey.startsWith("swim")) {
    return "swim";
  }
  if (splitKey.startsWith("bike")) {
    return "bike";
  }
  if (splitKey.startsWith("run")) {
    return "run";
  }
  if (splitKey === "transition_1_in" || splitKey === "bike_start") {
    return "transition";
  }
  return "other";
}

function transformedAccumulatedX(cumDistanceKm: number) {
  const bikeEnd = SWIM_KM + BIKE_KM;
  const bikeOffset = SWIM_KM + ACCUMULATED_GAP_KM;
  const runOffset = SWIM_KM + ACCUMULATED_GAP_KM + BIKE_KM + ACCUMULATED_GAP_KM;

  if (cumDistanceKm <= SWIM_KM + 1e-9) {
    return cumDistanceKm;
  }
  if (cumDistanceKm <= bikeEnd + 1e-9) {
    return cumDistanceKm - SWIM_KM + bikeOffset;
  }
  return cumDistanceKm - bikeEnd + runOffset;
}

function filterModelRowsByGroup(rows: ModelRow[], selectedGroup: GroupOption) {
  if (selectedGroup === "All") {
    return rows;
  }

  if (selectedGroup === "Top 10") {
    return rows.filter((row) => isTop10Rank(row.split_rank));
  }

  if (selectedGroup === "Black Shirt") {
    return rows.filter((row) => isBlackFinishType(row.finish_type));
  }

  if (selectedGroup === "White Shirt") {
    return rows.filter((row) => isWhiteFinishType(row.finish_type));
  }

  if (selectedGroup === "DNF") {
    return rows.filter((row) => isDnfFinishType(row.finish_type));
  }

  return rows;
}

function filterLongRowsByGroup(rows: LongRow[], selectedGroup: GroupOption) {
  if (selectedGroup === "All") {
    return rows;
  }

  if (selectedGroup === "Top 10") {
    return rows.filter((row) => isTop10Rank(row.overall_rank));
  }
  if (selectedGroup === "Black Shirt") {
    return rows.filter((row) => isBlackFinishType(row.finish_type));
  }
  if (selectedGroup === "White Shirt") {
    return rows.filter((row) => isWhiteFinishType(row.finish_type));
  }
  if (selectedGroup === "DNF") {
    return rows.filter((row) => isDnfFinishType(row.finish_type));
  }

  return rows;
}

function interpolateFrontierTime(entries: Array<{ cumTimeSeconds: number; probability: number }>) {
  const sorted = [...entries].sort((left, right) => left.cumTimeSeconds - right.cumTimeSeconds);
  const delta = sorted.map((entry) => entry.probability - TARGET_PROB);

  for (let index = 0; index < sorted.length; index += 1) {
    if (Math.abs(delta[index]) < 1e-9) {
      return {
        cumTimeSeconds: sorted[index].cumTimeSeconds,
        frontierProbability: TARGET_PROB,
        method: "interpolated" as const,
      };
    }
  }

  const candidates: Array<{ quality: number; frontierTime: number }> = [];
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const d1 = delta[index];
    const d2 = delta[index + 1];
    if (d1 * d2 >= 0) {
      continue;
    }

    const p1 = sorted[index].probability;
    const p2 = sorted[index + 1].probability;
    const t1 = sorted[index].cumTimeSeconds;
    const t2 = sorted[index + 1].cumTimeSeconds;
    if (Math.abs(p2 - p1) < 1e-9) {
      continue;
    }

    const frontierTime = t1 + ((TARGET_PROB - p1) * (t2 - t1)) / (p2 - p1);
    candidates.push({
      quality: (Math.abs(d1) + Math.abs(d2)) / 2,
      frontierTime,
    });
  }

  if (candidates.length > 0) {
    candidates.sort((left, right) => left.quality - right.quality);
    return {
      cumTimeSeconds: candidates[0].frontierTime,
      frontierProbability: TARGET_PROB,
      method: "interpolated" as const,
    };
  }

  let nearest = sorted[0];
  let nearestDelta = Math.abs(delta[0]);
  for (let index = 1; index < sorted.length; index += 1) {
    const distance = Math.abs(delta[index]);
    if (distance < nearestDelta) {
      nearest = sorted[index];
      nearestDelta = distance;
    }
  }
  return {
    cumTimeSeconds: nearest.cumTimeSeconds,
    frontierProbability: nearest.probability,
    method: "nearest" as const,
  };
}

function buildFrontierPoints(rows: ModelRow[]) {
  const grouped = new Map<string, ModelRow[]>();
  for (const row of rows) {
    if (!isFiniteNumber(row.cum_time_seconds) || !isFiniteNumber(row.p_black) || !isFiniteNumber(row.race_distance_km)) {
      continue;
    }
    const bucket = grouped.get(row.split_key) ?? [];
    bucket.push(row);
    grouped.set(row.split_key, bucket);
  }

  const points: FrontierPoint[] = [];
  for (const [splitKey, splitRows] of grouped.entries()) {
    const byTime = new Map<number, number[]>();
    for (const row of splitRows) {
      const key = Number(row.cum_time_seconds);
      const list = byTime.get(key) ?? [];
      list.push(Number(row.p_black));
      byTime.set(key, list);
    }

    const frontierEntries = [...byTime.entries()]
      .map(([cumTimeSeconds, probs]) => ({
        cumTimeSeconds,
        probability: probs.reduce((sum, value) => sum + value, 0) / probs.length,
      }))
      .sort((left, right) => left.cumTimeSeconds - right.cumTimeSeconds);

    if (frontierEntries.length === 0) {
      continue;
    }

    const interpolated = interpolateFrontierTime(frontierEntries);
    const speedCandidates = splitRows
      .filter((row) => isFiniteNumber(row.segment_speed_kmh))
      .map((row) => ({
        delta: Math.abs(Number(row.cum_time_seconds) - interpolated.cumTimeSeconds),
        speed: Number(row.segment_speed_kmh),
      }))
      .sort((left, right) => left.delta - right.delta);
    const sampleSize = Math.min(speedCandidates.length, Math.max(5, Math.round(speedCandidates.length * 0.1)));
    const sampledSpeeds = speedCandidates.slice(0, sampleSize).map((entry) => entry.speed);
    const speedRaw =
      sampledSpeeds.length > 0
        ? sampledSpeeds.reduce((sum, value) => sum + value, 0) / sampledSpeeds.length
        : null;

    const medianDistance = splitRows
      .map((row) => Number(row.race_distance_km))
      .sort((left, right) => left - right);
    const distance = medianDistance[Math.floor(medianDistance.length / 2)];

    points.push({
      splitKey,
      raceDistanceKm: distance,
      cumTimeSeconds: interpolated.cumTimeSeconds,
      frontierProbability: interpolated.frontierProbability,
      frontierMethod: interpolated.method,
      leg: inferLeg(splitKey),
      segmentDistanceKm: null,
      segmentTimeSeconds: null,
      segmentSpeedKmh: speedRaw,
    });
  }

  const order = new Map<string, number>(ORDERED_SPLIT_KEYS.map((key, index) => [key, index]));
  points.sort((left, right) => {
    const leftOrder = order.get(left.splitKey) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = order.get(right.splitKey) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.raceDistanceKm - right.raceDistanceKm;
  });

  let previousDistance = 0;
  let previousTime = 0;
  return points.map((point, index) => {
    const segmentDistanceKm = index === 0 ? SWIM_KM : point.raceDistanceKm - previousDistance;
    const segmentTimeSeconds = index === 0 ? point.cumTimeSeconds : point.cumTimeSeconds - previousTime;
    previousDistance = point.raceDistanceKm;
    previousTime = point.cumTimeSeconds;

    let segmentSpeedKmh =
      isFiniteNumber(segmentDistanceKm) &&
      isFiniteNumber(segmentTimeSeconds) &&
      segmentDistanceKm > 0 &&
      segmentTimeSeconds > 0
        ? (segmentDistanceKm / segmentTimeSeconds) * 3600
        : point.segmentSpeedKmh;

    if (isFiniteNumber(segmentSpeedKmh) && point.leg === "swim" && (segmentSpeedKmh < 1 || segmentSpeedKmh > 6.5)) {
      segmentSpeedKmh = point.segmentSpeedKmh;
    }
    if (isFiniteNumber(segmentSpeedKmh) && point.leg === "bike" && (segmentSpeedKmh < 5 || segmentSpeedKmh > 65)) {
      segmentSpeedKmh = point.segmentSpeedKmh;
    }
    if (isFiniteNumber(segmentSpeedKmh) && point.leg === "run" && (segmentSpeedKmh < 3 || segmentSpeedKmh > 25)) {
      segmentSpeedKmh = point.segmentSpeedKmh;
    }
    if (isFiniteNumber(segmentSpeedKmh) && (segmentSpeedKmh <= 0 || segmentSpeedKmh > 80)) {
      segmentSpeedKmh = null;
    }

    return {
      ...point,
      cumTimeSeconds: Math.max(point.cumTimeSeconds, previousTime),
      segmentDistanceKm,
      segmentTimeSeconds,
      segmentSpeedKmh,
    };
  });
}

function buildFrontierChartFigure(points: FrontierPoint[], courseRows: CourseProfileRow[], cutoffKm: number): PlotFigure {
  const course = courseRows
    .filter((row) => row.distance_km >= 0 && row.distance_km <= cutoffKm && isFiniteNumber(row.elev_norseman_m))
    .sort((left, right) => left.distance_km - right.distance_km);

  const speedX: Array<number | null> = [];
  const speedY: Array<number | null> = [];
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const x0 = index === 0 ? 0 : points[index - 1].raceDistanceKm;
    const x1 = point.raceDistanceKm;
    if (x1 - x0 <= 0.05 || !isFiniteNumber(point.segmentSpeedKmh)) {
      continue;
    }
    speedX.push(x0, x1, null);
    speedY.push(point.segmentSpeedKmh, point.segmentSpeedKmh, null);
  }

  const shapes: NonNullable<Layout["shapes"]> = [
    {
      type: "line",
      x0: cutoffKm,
      x1: cutoffKm,
      y0: 0,
      y1: 1,
      xref: "x",
      yref: "paper",
      line: { color: "rgba(255,255,255,0.9)", width: 1, dash: "dash" },
    },
  ];

  for (const x of [...new Set(points.map((point) => Number(point.raceDistanceKm.toFixed(3))))]) {
    if (x < 0 || x > cutoffKm) {
      continue;
    }
    shapes.push({
      type: "line",
      x0: x,
      x1: x,
      y0: 0,
      y1: 1,
      xref: "x",
      yref: "paper",
      line: { color: "rgba(255,255,255,0.24)", width: 1, dash: "dot" },
    });
  }

  return {
    data: [
      {
        type: "scatter",
        x: course.map((row) => row.distance_km),
        y: course.map((row) => row.elev_norseman_m ?? null),
        mode: "lines",
        name: "Elevation",
        line: { width: 2, color: "rgba(99,210,255,0.72)" },
        fill: "tozeroy",
        fillcolor: "rgba(99,210,255,0.14)",
        yaxis: "y2",
        hovertemplate: "km %{x:.1f}<br>Elev %{y:.0f} m<extra></extra>",
      },
      {
        type: "scatter",
        x: speedX,
        y: speedY,
        mode: "lines",
        name: "Frontier pace",
        line: { width: 6, color: FRONTIER_COLOR },
        hovertemplate: "Frontier speed %{y:.1f} km/h<extra></extra>",
      },
    ],
    layout: {
      paper_bgcolor: PANEL_BG,
      plot_bgcolor: PANEL_BG,
      font: { color: TEXT_COLOR, family: "IBM Plex Sans, sans-serif" },
      margin: { l: 40, r: 40, t: 26, b: 40 },
      legend: {
        orientation: "h",
        x: 1,
        y: 1.12,
        xanchor: "right",
        yanchor: "bottom",
      },
      shapes,
      xaxis: {
        title: { text: "Distance (km)" },
        range: [0, cutoffKm],
        tickfont: { color: TEXT_COLOR },
      },
      yaxis: {
        title: { text: "Frontier speed (km/h)" },
        gridcolor: GRID_COLOR,
        tickfont: { color: TEXT_COLOR },
      },
      yaxis2: {
        title: { text: "Elevation (m)" },
        overlaying: "y",
        side: "right",
        showgrid: false,
        tickfont: { color: TEXT_COLOR },
      },
    },
  };
}

function toAccumulatedCategory(row: LongRow): AbsoluteAccumulatedRow["category"] {
  const group = classifyFinishGroup(row);
  if (group === "Top 10") {
    return "Top10";
  }
  if (group === "Black Shirt") {
    return "Black";
  }
  if (group === "White Shirt") {
    return "White";
  }
  if (group === "DNF") {
    return "DNF";
  }
  return "Other";
}

function buildAbsoluteAccumulatedFigure(rows: LongRow[], frontierPoints: FrontierPoint[]): PlotFigure | null {
  const normalized = rows
    .filter((row) => isFiniteNumber(row.race_distance_km) && isFiniteNumber(row.cum_time_seconds))
    .map((row) => ({
      athleteId: athleteKey(row),
      category: toAccumulatedCategory(row),
      xPlot: transformedAccumulatedX(Number(row.race_distance_km)),
      cumTimeHours: Number(row.cum_time_seconds) / 3600,
    }))
    .sort((left, right) => {
      if (left.athleteId !== right.athleteId) {
        return left.athleteId.localeCompare(right.athleteId);
      }
      return left.xPlot - right.xPlot;
    });

  if (normalized.length === 0) {
    return null;
  }

  const grouped = new Map<string, AbsoluteAccumulatedRow[]>();
  for (const row of normalized) {
    const bucket = grouped.get(row.athleteId) ?? [];
    bucket.push(row);
    grouped.set(row.athleteId, bucket);
  }

  const categoryColors: Record<AbsoluteAccumulatedRow["category"], string> = {
    Top10: "#7cff92",
    Black: "#000000",
    White: "#ffffff",
    DNF: "#ff5959",
    Other: "#9b9b9b",
  };

  const data: Data[] = [];
  const seenLegend = new Set<AbsoluteAccumulatedRow["category"]>();
  for (const athleteRows of grouped.values()) {
    const category = athleteRows[0]?.category ?? "Other";
    data.push({
      type: "scatter",
      mode: "lines",
      x: athleteRows.map((row) => row.xPlot),
      y: athleteRows.map((row) => row.cumTimeHours),
      line: {
        color: categoryColors[category],
        width: category === "Top10" ? 1.8 : 1.1,
      },
      opacity: category === "Top10" ? 0.95 : 0.6,
      name: category,
      legendgroup: category,
      showlegend: !seenLegend.has(category),
      hoverinfo: "none",
    });
    seenLegend.add(category);
  }

  const frontierX = frontierPoints.map((point) => transformedAccumulatedX(point.raceDistanceKm));
  const frontierY = frontierPoints.map((point) => point.cumTimeSeconds / 3600);
  data.push({
    type: "scatter",
    mode: "lines+markers",
    x: frontierX,
    y: frontierY,
    name: "Frontier time",
    line: { color: FRONTIER_COLOR, width: 4 },
    marker: { color: FRONTIER_COLOR, size: 6 },
    hovertemplate: "Frontier<br>time %{y:.2f} h<extra></extra>",
  });

  const bikeOffset = SWIM_KM + ACCUMULATED_GAP_KM;
  const runOffset = SWIM_KM + ACCUMULATED_GAP_KM + BIKE_KM + ACCUMULATED_GAP_KM;

  return {
    data,
    layout: {
      paper_bgcolor: PANEL_BG,
      plot_bgcolor: PANEL_BG,
      font: { color: TEXT_COLOR, family: "IBM Plex Sans, sans-serif" },
      margin: { l: 40, r: 20, t: 20, b: 40 },
      legend: {
        orientation: "h",
        x: 1,
        y: 1.12,
        xanchor: "right",
        yanchor: "bottom",
      },
      xaxis: {
        title: { text: "Accumulated race distance" },
        tickmode: "array",
        tickvals: [0, SWIM_KM, bikeOffset + BIKE_KM, runOffset + RUN_KM],
        ticktext: ["0", `${SWIM_KM}`, `${BIKE_KM}`, `${RUN_KM}`],
        gridcolor: GRID_COLOR,
        zeroline: false,
      },
      yaxis: {
        title: { text: "Time (hours)" },
        gridcolor: GRID_COLOR,
        zeroline: false,
      },
      shapes: [
        {
          type: "line",
          x0: SWIM_KM,
          x1: SWIM_KM,
          y0: 0,
          y1: 1,
          xref: "x",
          yref: "paper",
          line: { color: "rgba(255,255,255,0.8)", width: 1 },
        },
        {
          type: "line",
          x0: bikeOffset + BIKE_KM,
          x1: bikeOffset + BIKE_KM,
          y0: 0,
          y1: 1,
          xref: "x",
          yref: "paper",
          line: { color: "rgba(255,255,255,0.8)", width: 1 },
        },
      ],
      annotations: [
        {
          x: SWIM_KM / 2,
          y: 1.06,
          xref: "x",
          yref: "paper",
          text: "Swim",
          showarrow: false,
        },
        {
          x: bikeOffset + BIKE_KM / 2,
          y: 1.06,
          xref: "x",
          yref: "paper",
          text: "Bike",
          showarrow: false,
        },
        {
          x: runOffset + RUN_KM / 2,
          y: 1.06,
          xref: "x",
          yref: "paper",
          text: "Run",
          showarrow: false,
        },
      ],
    },
  };
}

function buildRelativeAccumulatedFigure(rows: LongRow[], frontierPoints: FrontierPoint[]): PlotFigure | null {
  const athleteSplitRows = rows.filter(
    (row) =>
      Number.isFinite(Number(row.bib)) &&
      row.split_key.trim().length > 0 &&
      isFiniteNumber(row.cum_time_seconds),
  );
  const athleteSplitMap = new Map<string, number[]>();
  for (const row of athleteSplitRows) {
    const key = `${row.bib}:${row.split_key}`;
    const bucket = athleteSplitMap.get(key) ?? [];
    bucket.push(Number(row.cum_time_seconds));
    athleteSplitMap.set(key, bucket);
  }

  const athleteSplitMedianRows = [...athleteSplitMap.entries()].map(([key, values]) => {
    const [bibText, splitKey] = key.split(":");
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    const medianSeconds =
      sorted.length % 2 === 0
        ? (sorted[middle - 1] + sorted[middle]) / 2
        : sorted[middle];

    return {
      bib: Number(bibText),
      splitKey,
      cumTimeSeconds: medianSeconds,
    };
  });

  const frontierBySplit = new Map(
    frontierPoints.map((point) => [point.splitKey, point] as const),
  );

  const merged: RelativePoint[] = [];
  const athleteMetaByBib = new Map<number, { groupLabel: RelativePoint["groupLabel"]; label: string }>();
  for (const row of athleteSplitRows) {
    if (athleteMetaByBib.has(row.bib)) {
      continue;
    }

    let groupLabel: RelativePoint["groupLabel"] = "White Shirt";
    const finishType = row.finish_type.toLowerCase();
    if (finishType.includes("dnf") || finishType.includes("did not finish") || finishType.includes("dns")) {
      groupLabel = "DNF";
    } else if (finishType.includes("black")) {
      groupLabel = "Black Shirt";
    } else if (finishType.includes("white")) {
      groupLabel = "White Shirt";
    }
    if (isTop10Rank(row.overall_rank) && groupLabel !== "DNF") {
      groupLabel = "Top 10";
    }

    athleteMetaByBib.set(row.bib, {
      groupLabel,
      label: row.name.trim().length > 0 ? `${row.name} (#${row.bib})` : `#${row.bib}`,
    });
  }

  for (const row of athleteSplitMedianRows) {
    const frontier = frontierBySplit.get(row.splitKey);
    if (!frontier) {
      continue;
    }
    const athleteMeta = athleteMetaByBib.get(row.bib);
    merged.push({
      bib: row.bib,
      label: athleteMeta?.label ?? `#${row.bib}`,
      groupLabel: athleteMeta?.groupLabel ?? "White Shirt",
      distanceKm: frontier.raceDistanceKm,
      deltaHours: (row.cumTimeSeconds - frontier.cumTimeSeconds) / 3600,
    });
  }

  if (merged.length === 0) {
    return null;
  }

  const grouped = new Map<number, RelativePoint[]>();
  for (const row of merged) {
    const bucket = grouped.get(row.bib) ?? [];
    bucket.push(row);
    grouped.set(row.bib, bucket);
  }

  const groupColors: Record<RelativePoint["groupLabel"], string> = {
    "Top 10": "#7cff92",
    "Black Shirt": "#000000",
    "White Shirt": "#ffffff",
    DNF: "#ff5959",
    Other: "#9b9b9b",
  };

  const data: Data[] = [];
  for (const athleteRows of grouped.values()) {
    athleteRows.sort((left, right) => left.distanceKm - right.distanceKm);
    const label = athleteRows[0]?.label ?? "";
    const groupLabel = athleteRows[0]?.groupLabel ?? "Other";
    data.push({
      type: "scatter",
      mode: "lines",
      x: athleteRows.map((row) => row.distanceKm),
      y: athleteRows.map((row) => row.deltaHours),
      name: label,
      showlegend: false,
      line: {
        width: groupLabel === "Top 10" ? 1.6 : 1.2,
        color: groupColors[groupLabel],
      },
      hovertemplate: `${label}<br>Distance %{x:.1f} km<br>Delta %{y:+.2f} h<extra></extra>`,
    });
  }

  return {
    data,
    layout: {
      paper_bgcolor: PANEL_BG,
      plot_bgcolor: PANEL_BG,
      font: { color: TEXT_COLOR, family: "IBM Plex Sans, sans-serif" },
      margin: { l: 40, r: 20, t: 20, b: 40 },
      xaxis: {
        title: { text: "Distance (km)" },
        gridcolor: GRID_COLOR,
      },
      yaxis: {
        title: { text: "Athlete time vs frontier (h)" },
        gridcolor: GRID_COLOR,
        zeroline: false,
      },
      shapes: [
        {
          type: "line",
          x0: 0,
          x1: 1,
          y0: 0,
          y1: 0,
          xref: "paper",
          yref: "y",
          line: { color: FRONTIER_COLOR, width: 2, dash: "dash" },
        },
      ],
      annotations: [
        {
          x: 0.01,
          y: 0,
          xref: "paper",
          yref: "y",
          text: "Frontier (0 h)",
          showarrow: false,
          yshift: 12,
        },
      ],
    },
  };
}

function toTableRows(points: FrontierPoint[]): FrontierTableRow[] {
  return points.map((point) => ({
    splitKey: point.splitKey,
    distanceKm: point.raceDistanceKm.toFixed(1),
    segmentTime: formatHms(point.segmentTimeSeconds),
    cumulativeTime: formatHms(point.cumTimeSeconds),
    frontierSpeedKmh: isFiniteNumber(point.segmentSpeedKmh) ? point.segmentSpeedKmh.toFixed(1) : "—",
  }));
}

export function buildFrontierPaceModel(
  modelRows: ModelRow[],
  longRows: LongRow[],
  courseRows: CourseProfileRow[],
  selectedYear: number | "All",
  selectedGroup: GroupOption,
  mode: FrontierMode,
): FrontierPaceModel {
  const filteredModelRows = filterModelRowsByGroup(
    filterRowsByYear(modelRows, selectedYear).filter(
      (row) =>
        (row.set === undefined || row.set === "test") &&
        isFiniteNumber(row.race_distance_km) &&
        isFiniteNumber(row.cum_time_seconds) &&
        isFiniteNumber(row.p_black),
    ),
    selectedGroup,
  );

  if (filteredModelRows.length === 0) {
    return {
      chartFigure: null,
      accumulatedFigure: null,
      tableRows: [],
      totalTimeLabel: null,
      warning: "No model data is available for the current filters.",
    };
  }

  const cutoffKm = cutoffTotalKmForYear(
    selectedYear,
    Math.max(...filteredModelRows.map((row) => Number(row.race_distance_km))),
  );
  const clippedModelRows = filteredModelRows.filter((row) => Number(row.race_distance_km) <= cutoffKm);
  const frontierPoints = buildFrontierPoints(clippedModelRows);

  if (frontierPoints.length === 0) {
    return {
      chartFigure: null,
      accumulatedFigure: null,
      tableRows: [],
      totalTimeLabel: null,
      warning: "Could not compute the 50% frontier for the current filters.",
    };
  }

  const chartFigure = buildFrontierChartFigure(frontierPoints, courseRows, cutoffKm);
  const filteredLongRows = filterLongRowsByGroup(filterRowsByYear(longRows, selectedYear), selectedGroup);
  const accumulatedFigure =
    mode === "absolute"
      ? buildAbsoluteAccumulatedFigure(filteredLongRows, frontierPoints)
      : buildRelativeAccumulatedFigure(filteredLongRows, frontierPoints);

  return {
    chartFigure,
    accumulatedFigure,
    tableRows: toTableRows(frontierPoints),
    totalTimeLabel: formatHms(frontierPoints[frontierPoints.length - 1]?.cumTimeSeconds ?? null),
    warning: accumulatedFigure ? null : "Frontier pace is available, but the accumulated comparison view could not be generated for this filter.",
  };
}
