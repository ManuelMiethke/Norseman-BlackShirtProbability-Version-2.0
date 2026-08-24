import type { Data, Layout } from "plotly.js";

import type { GroupOption } from "@/config/raceRegistry";
import { classifyFinishGroup, filterRowsByYear } from "@/lib/groups";
import type { CourseProfileRow, LongRow } from "@/types/data";

const COL_GROUP = "group";
const GROUP_TOP10 = "Top 10";
const GROUP_BLACK = "Black Shirt";
const GROUP_WHITE = "White Shirt";
const GROUP_DNF = "DNF";
const GROUPS_ORDER = [GROUP_TOP10, GROUP_BLACK, GROUP_WHITE];

const SWIM_KM = 3.8;
const BIKE_KM = 180.0;
const RUN_KM = 42.2;

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
  "run_40km_right_before_mt_gaustatoppen",
  "finish_black_t_shirt",
  "finish_white_t_shirt",
] as const;

const BIKE_CHECKPOINTS = [
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
] as const;

const RUN_CHECKPOINTS_BLACK = [
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
  "run_40km_right_before_mt_gaustatoppen",
  "finish_black_t_shirt",
] as const;

const WHITE_FINISH_KEY = "finish_white_t_shirt";
const WHITE_LAST_START_CANDIDATES = [
  "run_37_5km_stavsro_cut_off",
  "run_32_5km_langefonn",
] as const;

type WeatherRow = {
  splitKey: string;
  raceDistanceKm: number;
  temperature2m?: number;
  windDirection10m?: number;
  windEffect?: string;
  weatherEmoji?: string;
  x: number;
};

type SpeedRow = {
  group: string;
  segmentStartKey: string;
  segmentEndKey: string;
  speed: number;
};

type SegmentPair = {
  start: string | null;
  end: string;
  leg: "swim" | "bike" | "run";
};

type PlotFigure = {
  data: Data[];
  layout: Partial<Layout>;
};

export type CourseWeatherSpeedModel = {
  figure: PlotFigure | null;
  warning: string | null;
  effectiveYear: number | null;
};

function median(values: number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function roundKm(value: number): number {
  // Avoids floating-point noise like 9.8 - 3.8 === 6.000000000000001
  // when rendering leg-relative distance labels.
  return Math.round(value * 100) / 100;
}

function modeValue(values: Array<string | undefined>) {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) {
      continue;
    }
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestCount = -1;
  for (const [value, count] of counts.entries()) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

function buildSegmentPairs(): SegmentPair[] {
  const pairs: SegmentPair[] = [{ start: null, end: "swim_finish", leg: "swim" }];
  for (let index = 0; index < BIKE_CHECKPOINTS.length - 1; index += 1) {
    pairs.push({
      start: BIKE_CHECKPOINTS[index],
      end: BIKE_CHECKPOINTS[index + 1],
      leg: "bike",
    });
  }
  for (let index = 0; index < RUN_CHECKPOINTS_BLACK.length - 1; index += 1) {
    pairs.push({
      start: RUN_CHECKPOINTS_BLACK[index],
      end: RUN_CHECKPOINTS_BLACK[index + 1],
      leg: "run",
    });
  }
  pairs.push({ start: "WHITE_DYNAMIC", end: WHITE_FINISH_KEY, leg: "run" });
  return pairs;
}

const SEGMENT_PAIRS = buildSegmentPairs();

function groupLabel(row: LongRow) {
  return classifyFinishGroup(row, { dnfBeforeTop10: true });
}

function parseKmFromKey(key: string) {
  const source = String(key);
  if (source.startsWith("bike_") && source.includes("km")) {
    const raw = source.split("bike_", 2)[1].split("km", 2)[0].split("_").join(".");
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (source.startsWith("run_") && source.includes("km")) {
    const raw = source.split("run_", 2)[1].split("km", 2)[0].split("_").join(".");
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function canonicalCumDist(key: string | null) {
  if (key === null) {
    return 0;
  }
  if (key === "swim_finish") {
    return SWIM_KM;
  }
  if (key === "transition_1_in" || key === "bike_start") {
    return SWIM_KM;
  }
  if (key.startsWith("bike_") && key.includes("km")) {
    const km = parseKmFromKey(key);
    return km === null ? null : SWIM_KM + km;
  }
  if (key === "bike_180km_finish" || key === "run_start") {
    return SWIM_KM + BIKE_KM;
  }
  if (key.startsWith("run_") && key.includes("km")) {
    const km = parseKmFromKey(key);
    return km === null ? null : SWIM_KM + BIKE_KM + km;
  }
  if (key === "finish_black_t_shirt" || key === "finish_white_t_shirt") {
    return SWIM_KM + BIKE_KM + RUN_KM;
  }
  return null;
}

function windArrowFromDeg(value?: number) {
  if (value === undefined || Number.isNaN(value)) {
    return "？";
  }
  const normalized = ((value % 360) + 360) % 360;
  if (normalized >= 337.5 || normalized < 22.5) return "↓";
  if (normalized < 67.5) return "↙";
  if (normalized < 112.5) return "←";
  if (normalized < 157.5) return "↖";
  if (normalized < 202.5) return "↑";
  if (normalized < 247.5) return "↗";
  if (normalized < 292.5) return "→";
  return "↘";
}

function windColorFromEffect(effect?: string) {
  return effect && effect.toLowerCase().includes("tail") ? "limegreen" : "red";
}

function aggregateWeather(rows: LongRow[], year: number): WeatherRow[] {
  const scoped = filterRowsByYear(rows, year)
    .filter((row) => ORDERED_SPLIT_KEYS.includes(row.split_key as never))
    .map((row) => ({
      splitKey: row.split_key,
      raceDistanceKm: Number(row.race_distance_km ?? Number.NaN),
      splitDistanceKm: Number(row.split_distance_km ?? Number.NaN),
      temperature2m: row.temperature_2m,
      windDirection10m: row.wind_direction_10m,
      windEffect: row.wind_effect,
      weatherEmoji: row.weather_emoji,
      stationName: row.station_name,
    }));

  const bySplit = new Map<string, typeof scoped>();
  for (const row of scoped) {
    const list = bySplit.get(row.splitKey) ?? [];
    list.push(row);
    bySplit.set(row.splitKey, list);
  }

  const aggregated = ORDERED_SPLIT_KEYS
    .map((splitKey) => {
      const values = bySplit.get(splitKey);
      if (!values || values.length === 0) {
        return null;
      }

      const raceDistanceKm = median(
        values.map((row) => row.raceDistanceKm).filter((value) => Number.isFinite(value)),
      );
      if (raceDistanceKm === undefined) {
        return null;
      }

      return {
        splitKey,
        raceDistanceKm,
        temperature2m: median(
          values
            .map((row) => row.temperature2m)
            .filter((value): value is number => value !== undefined && Number.isFinite(value)),
        ),
        windDirection10m: median(
          values
            .map((row) => row.windDirection10m)
            .filter((value): value is number => value !== undefined && Number.isFinite(value)),
        ),
        windEffect: modeValue(values.map((row) => row.windEffect)),
        weatherEmoji: modeValue(values.map((row) => row.weatherEmoji)),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (aggregated.length > 0) {
    aggregated[0].weatherEmoji = "🌊";
  }

  const withOffsets: WeatherRow[] = [];
  const duplicateCounts = new Map<number, number>();
  for (const row of aggregated) {
    const count = duplicateCounts.get(row.raceDistanceKm) ?? 0;
    duplicateCounts.set(row.raceDistanceKm, count + 1);
    withOffsets.push({
      splitKey: row.splitKey,
      raceDistanceKm: row.raceDistanceKm,
      temperature2m: row.temperature2m,
      windDirection10m: row.windDirection10m,
      windEffect: row.windEffect,
      weatherEmoji: row.weatherEmoji,
      x: row.raceDistanceKm + count * 0.02,
    });
  }

  return withOffsets;
}

function aggregateSpeedByGroup(rows: LongRow[], year: number, groupsToPlot: string[]): SpeedRow[] {
  const scoped = filterRowsByYear(rows, year)
    .filter((row) => ORDERED_SPLIT_KEYS.includes(row.split_key as never))
    .map((row) => ({
      bib: Number(row.bib),
      group: groupLabel(row),
      splitKey: row.split_key,
      raceDistanceKm: Number(row.race_distance_km ?? Number.NaN),
      cumTimeSeconds: Number(row.cum_time_seconds ?? Number.NaN),
      segmentSpeedKmh: Number(row.segment_speed_kmh ?? Number.NaN),
    }))
    .filter((row) => Number.isFinite(row.bib));

  const distMap = new Map<string, number>();
  for (const splitKey of ORDERED_SPLIT_KEYS) {
    const distance = median(
      scoped
        .filter((row) => row.splitKey === splitKey)
        .map((row) => row.raceDistanceKm)
        .filter((value) => Number.isFinite(value)),
    );
    if (distance !== undefined) {
      distMap.set(splitKey, distance);
    }
  }

  const precomputedSpeed = new Map<string, number>();
  for (const group of groupsToPlot) {
    for (const splitKey of ORDERED_SPLIT_KEYS) {
      const speed = median(
        scoped
          .filter((row) => row.group === group && row.splitKey === splitKey)
          .map((row) => row.segmentSpeedKmh)
          .filter((value) => Number.isFinite(value)),
      );
      if (speed !== undefined) {
        precomputedSpeed.set(`${group}:${splitKey}`, speed);
      }
    }
  }

  const athleteMedianTimes = new Map<string, Map<string, number>>();
  const groupedSamples = new Map<string, Map<string, number[]>>();
  for (const row of scoped) {
    if (!groupsToPlot.includes(row.group) || !Number.isFinite(row.cumTimeSeconds)) {
      continue;
    }
    const athleteKey = `${row.bib}:${row.group}`;
    const sampleMap = groupedSamples.get(athleteKey) ?? new Map<string, number[]>();
    const bucket = sampleMap.get(row.splitKey) ?? [];
    bucket.push(row.cumTimeSeconds);
    sampleMap.set(row.splitKey, bucket);
    groupedSamples.set(athleteKey, sampleMap);
  }

  for (const [athleteKey, splitMap] of groupedSamples.entries()) {
    const medians = new Map<string, number>();
    for (const [splitKey, samples] of splitMap.entries()) {
      const sampleMedian = median(samples);
      if (sampleMedian !== undefined) {
        medians.set(splitKey, sampleMedian);
      }
    }
    athleteMedianTimes.set(athleteKey, medians);
  }

  const segmentSamples = new Map<string, number[]>();

  for (const [athleteKey, times] of athleteMedianTimes.entries()) {
    const group = athleteKey.split(":")[1];

    const getTime = (key: string | null) => {
      if (key === null) {
        return 0;
      }
      if (key === "bike_start" && !times.has(key)) {
        return times.get("transition_1_in");
      }
      return times.get(key);
    };

    const getDist = (key: string | null) => {
      if (key === null) {
        return 0;
      }
      if (distMap.has(key)) {
        return distMap.get(key);
      }
      return canonicalCumDist(key);
    };

    const resolveWhiteStart = () => {
      for (const candidate of WHITE_LAST_START_CANDIDATES) {
        if (getTime(candidate) !== undefined) {
          return candidate;
        }
      }
      return null;
    };

    for (const segment of SEGMENT_PAIRS) {
      let start = segment.start;
      const end = segment.end;

      if (start === "WHITE_DYNAMIC") {
        if (group !== GROUP_WHITE) {
          continue;
        }
        start = resolveWhiteStart();
        if (start === null) {
          continue;
        }
      }

      if (end === "finish_black_t_shirt" && group === GROUP_WHITE) {
        continue;
      }
      if (end === WHITE_FINISH_KEY && group !== GROUP_WHITE) {
        continue;
      }

      const t0 = getTime(start);
      const t1 = getTime(end);
      const d0 = getDist(start);
      const d1 = getDist(end);

      let speed: number | undefined;
      if (
        t0 !== undefined &&
        t1 !== undefined &&
        d0 !== undefined &&
        d0 !== null &&
        d1 !== undefined &&
        d1 !== null &&
        Number.isFinite(t0) &&
        Number.isFinite(t1) &&
        Number.isFinite(d0) &&
        Number.isFinite(d1)
      ) {
        const dt = t1 - t0;
        const dd = d1 - d0;
        if (dt > 0 && dd > 0.05) {
          speed = (dd / dt) * 3600;
        }
      }

      if (
        speed === undefined ||
        (segment.leg === "swim" && (speed < 0.3 || speed > 12)) ||
        (segment.leg === "bike" && (speed < 3 || speed > 140)) ||
        (segment.leg === "run" && (speed < 2 || speed > 35))
      ) {
        speed = precomputedSpeed.get(`${group}:${end}`);
      }

      if (speed === undefined || !Number.isFinite(speed)) {
        continue;
      }

      const bucketKey = `${group}:${start ?? "race_start"}:${end}`;
      const bucket = segmentSamples.get(bucketKey) ?? [];
      bucket.push(speed);
      segmentSamples.set(bucketKey, bucket);
    }
  }

  const output: SpeedRow[] = [];
  for (const [bucketKey, samples] of segmentSamples.entries()) {
    const value = median(samples);
    if (value === undefined) {
      continue;
    }
    const [group, segmentStartKey, segmentEndKey] = bucketKey.split(":");
    output.push({ group, segmentStartKey, segmentEndKey, speed: value });
  }

  const splitOrder = new Map<string, number>(ORDERED_SPLIT_KEYS.map((key, index) => [key, index]));
  return output.sort(
    (left, right) =>
      (splitOrder.get(left.segmentEndKey) ?? 999) - (splitOrder.get(right.segmentEndKey) ?? 999),
  );
}

function buildSplitDistMap(rows: LongRow[], year: number) {
  const map = new Map<string, number>();
  const scoped = filterRowsByYear(rows, year);
  for (const splitKey of ORDERED_SPLIT_KEYS) {
    const distance = median(
      scoped
        .filter((row) => row.split_key === splitKey)
        .map((row) => Number(row.race_distance_km ?? Number.NaN))
        .filter((value) => Number.isFinite(value)),
    );
    if (distance !== undefined) {
      map.set(splitKey, distance);
    }
  }

  map.set("race_start", 0);
  map.set("swim_finish", SWIM_KM);
  map.set("transition_1_in", SWIM_KM);
  map.set("bike_start", SWIM_KM);
  map.set("bike_180km_finish", SWIM_KM + BIKE_KM);
  map.set("run_start", SWIM_KM + BIKE_KM);
  map.set("finish_black_t_shirt", SWIM_KM + BIKE_KM + RUN_KM);
  map.set("finish_white_t_shirt", SWIM_KM + BIKE_KM + RUN_KM);

  for (const key of ORDERED_SPLIT_KEYS) {
    if (key.startsWith("bike_") && key.includes("km")) {
      const km = parseKmFromKey(key);
      if (km !== null) {
        map.set(key, SWIM_KM + km);
      }
    }
    if (key.startsWith("run_") && key.includes("km")) {
      const km = parseKmFromKey(key);
      if (km !== null) {
        map.set(key, SWIM_KM + BIKE_KM + km);
      }
    }
  }

  return map;
}

function buildCourseWeatherSpeedFigure(
  courseRows: CourseProfileRow[],
  weatherRows: WeatherRow[],
  speedRows: SpeedRow[],
  groupsToPlot: string[],
  splitDistMap: Map<string, number>,
): PlotFigure {
  const bikeOffset = SWIM_KM;
  const runOffset = SWIM_KM + BIKE_KM;
  const xMax = runOffset + RUN_KM;

  const xTransform = (distance: number) => {
    if (distance <= SWIM_KM) return distance;
    if (distance <= SWIM_KM + BIKE_KM) return distance;
    return distance;
  };

  const weatherX = new Map<string, number>();
  for (const row of weatherRows) {
    weatherX.set(row.splitKey, row.x);
  }
  weatherX.set("race_start", 0);

  const xOf = (key: string) => weatherX.get(key) ?? splitDistMap.get(key) ?? canonicalCumDist(key) ?? null;

  const legKmLabelFromKey = (key: string) => {
    const distance = splitDistMap.get(key);
    if (distance === undefined) {
      return null;
    }
    if (distance <= SWIM_KM) {
      return `${roundKm(distance)}`;
    }
    if (distance <= SWIM_KM + BIKE_KM) {
      return `${roundKm(distance - SWIM_KM)}`;
    }
    return `${roundKm(distance - SWIM_KM - BIKE_KM)}`;
  };

  const data: Data[] = [];
  data.push({
    type: "scatter",
    x: courseRows.map((row) => xTransform(row.distance_km)),
    y: courseRows.map((row) => row.elev_norseman_m ?? null),
    fill: "tozeroy",
    name: "Norseman elevation",
    mode: "lines",
    line: { width: 1 },
    fillcolor: "rgba(255,255,255,0.18)",
    opacity: 0.55,
    yaxis: "y2",
    hovertemplate: "km %{x:.1f}<br>Elev: %{y:.0f} m<extra></extra>",
  });

  if (courseRows.some((row) => row.elev_hawaii_m !== undefined)) {
    data.push({
      type: "scatter",
      x: courseRows.map((row) => xTransform(row.distance_km)),
      y: courseRows.map((row) => row.elev_hawaii_m ?? null),
      name: "Ironman Hawaii elevation",
      mode: "lines",
      line: { width: 2, dash: "dash" },
      opacity: 0.99,
      yaxis: "y2",
      hovertemplate: "Hawaii km %{x:.1f}<br>Elev: %{y:.0f} m<extra></extra>",
    });
  }

  data.push({
    type: "scatter",
    x: [0],
    y: [0],
    mode: "markers",
    marker: {
      symbol: "arrow-up",
      color: "limegreen",
      size: 14,
      line: { color: "white", width: 1 },
    },
    showlegend: true,
    name: "Wind arrow (green = tailwind)",
    hoverinfo: "skip",
    opacity: 0.01,
  });

  const preferredOrder = [GROUP_WHITE, GROUP_BLACK, GROUP_TOP10];
  const plotGroups = [...groupsToPlot].sort(
    (left, right) =>
      preferredOrder.indexOf(left) - preferredOrder.indexOf(right),
  );
  const groupOffsets: Record<string, number> = {
    [GROUP_TOP10]: 0.35,
    [GROUP_BLACK]: -0.35,
    [GROUP_WHITE]: 0,
  };
  const colorMap: Record<string, string> = {
    [GROUP_TOP10]: "#00ff00",
    [GROUP_BLACK]: "#000000",
    [GROUP_WHITE]: "#ffffff",
  };

  for (const group of plotGroups) {
    const groupRows = speedRows.filter((row) => row.group === group);
    if (groupRows.length === 0) {
      continue;
    }
    const x: Array<number | null> = [];
    const y: Array<number | null> = [];
    const customdata: Array<number | null> = [];
    const yOffset = groupOffsets[group] ?? 0;

    for (const row of groupRows) {
      const x0 = xOf(row.segmentStartKey);
      const x1 = xOf(row.segmentEndKey);
      if (x0 === null || x1 === null) {
        continue;
      }
      const startX = xTransform(x0);
      const endX = xTransform(x1 === x0 ? x1 + 0.02 : x1);
      const speed = row.speed;
      x.push(startX, endX, null);
      y.push(speed + yOffset, speed + yOffset, null);
      customdata.push(speed, speed, null);
    }

    data.push({
      type: "scatter",
      x,
      y,
      customdata,
      mode: "lines",
      name: `${group} median speed`,
      line: { width: 5, color: colorMap[group] },
      hovertemplate: `${group}<br>v = %{customdata:.1f} km/h<extra></extra>`,
    });
  }

  const shapes: NonNullable<Layout["shapes"]> = [];
  for (const key of ORDERED_SPLIT_KEYS) {
    const xValue = xOf(key);
    if (xValue === null) {
      continue;
    }
    shapes.push({
      type: "line",
      xref: "x",
      yref: "paper",
      x0: xTransform(xValue),
      x1: xTransform(xValue),
      y0: 0,
      y1: 1,
      line: { color: "rgba(255,255,255,0.35)", width: 1, dash: "dot" },
      layer: "below",
    });
  }
  for (const key of ["swim_finish", "run_start"]) {
    const xValue = xOf(key);
    if (xValue === null) {
      continue;
    }
    shapes.push({
      type: "line",
      xref: "x",
      yref: "paper",
      x0: xTransform(xValue),
      x1: xTransform(xValue),
      y0: 0,
      y1: 1,
      line: { color: "orange", width: 2, dash: "dash" },
      layer: "above",
    });
  }

  const annotations: NonNullable<Layout["annotations"]> = [];
  const weatherSorted = [...weatherRows].sort((left, right) => left.raceDistanceKm - right.raceDistanceKm);
  const sparse: WeatherRow[] = [];
  let lastDistance: number | null = null;
  for (const row of weatherSorted) {
    if (lastDistance === null || row.raceDistanceKm - lastDistance >= 10) {
      sparse.push(row);
      lastDistance = row.raceDistanceKm;
    }
  }

  for (const row of sparse) {
    const xValue = xTransform(row.x);
    const arrow = windArrowFromDeg(row.windDirection10m);
    const showArrow = arrow !== "？" && row.splitKey !== "swim_finish";
    if (showArrow) {
      annotations.push({
        x: xValue,
        y: 1.16,
        xref: "x",
        yref: "paper",
        text: arrow,
        showarrow: false,
        font: { size: 14, color: windColorFromEffect(row.windEffect) },
        xanchor: "center",
        yanchor: "middle",
      });
    }
    annotations.push({
      x: xValue,
      y: 1.09,
      xref: "x",
      yref: "paper",
      text: row.weatherEmoji ?? "❔",
      showarrow: false,
      font: { size: 18 },
      xanchor: "center",
      yanchor: "middle",
    });
    annotations.push({
      x: xValue,
      y: 1.03,
      xref: "x",
      yref: "paper",
      text: row.temperature2m !== undefined ? `${row.temperature2m.toFixed(1)}°C` : "–",
      showarrow: false,
      font: { size: 11 },
      xanchor: "center",
      yanchor: "middle",
    });
  }

  annotations.push(
    {
      x: SWIM_KM / 2,
      y: 1.26,
      xref: "x",
      yref: "paper",
      text: "Swim",
      showarrow: false,
      font: { color: "white", size: 13 },
      xanchor: "center",
    },
    {
      x: bikeOffset + BIKE_KM / 2,
      y: 1.26,
      xref: "x",
      yref: "paper",
      text: "Bike",
      showarrow: false,
      font: { color: "white", size: 13 },
      xanchor: "center",
    },
    {
      x: runOffset + RUN_KM / 2,
      y: 1.26,
      xref: "x",
      yref: "paper",
      text: "Run",
      showarrow: false,
      font: { color: "white", size: 13 },
      xanchor: "center",
    },
  );

  const tickValues = [0, SWIM_KM, bikeOffset + BIKE_KM, runOffset + RUN_KM];
  const tickText = ["0", `${SWIM_KM}`, `${BIKE_KM}`, `${RUN_KM}`];
  for (const key of [
    "bike_6km_ovre_eidfjord",
    "bike_36km_dyranut",
    "bike_66km_haugastol",
    "bike_90km_geilo",
    "bike_123km_vasstulan",
    "bike_152km_end_imingfjell",
    "run_10km",
    "run_25km_zombie_hill_base",
    "run_37_5km_stavsro_cut_off",
  ]) {
    const xValue = xOf(key);
    const label = legKmLabelFromKey(key);
    if (xValue === null || label === null) {
      continue;
    }
    tickValues.push(xTransform(xValue));
    tickText.push(label);
  }

  const pairs = tickValues
    .map((value, index) => ({ value, label: tickText[index] }))
    .sort((left, right) => left.value - right.value);

  return {
    data,
    layout: {
      paper_bgcolor: "#7A7A7A",
      plot_bgcolor: "#7A7A7A",
      font: { color: "#ffffff" },
      margin: { l: 46, r: 88, t: 88, b: 50 },
      height: 560,
      hovermode: "x unified",
      legend: {
        orientation: "v",
        yanchor: "top",
        y: 1,
        xanchor: "left",
        x: 1.02,
        bgcolor: "rgba(0,0,0,0)",
        font: { color: "#ffffff", size: 11 },
      },
      annotations,
      shapes,
      xaxis: {
        title: { text: "Distance (km)", font: { color: "#ffffff", size: 15 } },
        range: [0, xMax],
        tickmode: "array",
        tickvals: pairs.map((pair) => pair.value),
        ticktext: pairs.map((pair) => pair.label),
        tickfont: { color: "#ffffff", size: 11 },
      },
      yaxis: {
        title: { text: "Speed (km/h)", font: { color: "#ffffff", size: 15 } },
        range: [0, 70],
        tickmode: "array",
        tickvals: [0, 10, 20, 30, 40, 50, 60, 70],
        showgrid: true,
        zeroline: false,
        tickfont: { color: "#ffffff", size: 11 },
      },
      yaxis2: {
        title: { text: "Elevation (m)", font: { color: "#ffffff", size: 15 } },
        overlaying: "y",
        side: "right",
        rangemode: "tozero",
        showgrid: false,
        zeroline: false,
        tickfont: { color: "#ffffff", size: 11 },
      },
    },
  };
}

export function buildCourseWeatherSpeedModel(
  longRows: LongRow[],
  courseRows: CourseProfileRow[],
  selectedYear: number | "All",
  selectedGroup: GroupOption,
): CourseWeatherSpeedModel {
  if (longRows.length === 0 || courseRows.length === 0) {
    return {
      figure: null,
      warning: "Course or split data is not available.",
      effectiveYear: null,
    };
  }

  const effectiveYear =
    selectedYear === "All"
      ? Math.max(...longRows.map((row) => Number(row.year)).filter((year) => Number.isFinite(year)))
      : selectedYear;

  const availableGroups = new Set<string>(longRows.map((row) => groupLabel(row)));
  let groupsToPlot: string[] = [];
  if (selectedGroup === "All") {
    groupsToPlot = GROUPS_ORDER.filter((group) => availableGroups.has(group));
  } else if (selectedGroup === GROUP_DNF) {
    groupsToPlot = [];
  } else if (availableGroups.has(selectedGroup)) {
    groupsToPlot = [selectedGroup];
  }

  const splitDistMap = buildSplitDistMap(longRows, effectiveYear);
  const weatherRows = aggregateWeather(longRows, effectiveYear);
  const speedRows = aggregateSpeedByGroup(longRows, effectiveYear, groupsToPlot);

  return {
    figure: buildCourseWeatherSpeedFigure(courseRows, weatherRows, speedRows, groupsToPlot, splitDistMap),
    warning:
      selectedGroup === GROUP_DNF
        ? "DNF does not render a median speed line in this chart, so the course and weather context is shown without a group speed overlay."
        : null,
    effectiveYear,
  };
}
