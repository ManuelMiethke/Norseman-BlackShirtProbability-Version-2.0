import type { Data, Layout } from "plotly.js";

import { CUTOFF_37_5_YEARS } from "@/config/raceRegistry";
import type { CourseProfileRow, LongRow } from "@/types/data";

import { PALETTE } from "@/lib/theme";
const TARGET_TOTAL_SECS = 13 * 3600 + 51 * 60;
const PREF_OPTIONS = ["p10", "p25", "p50", "p75", "p90"] as const;

const PREF_FACTORS: Record<EmpiricalPref, number> = {
  p10: 1.12,
  p25: 1.06,
  p50: 1.0,
  p75: 0.94,
  p90: 0.88,
};

const BASELINE_LEG_SECS = {
  swim: 70 * 60,
  t1: 5 * 60,
  bike: 6 * 3600 + 40 * 60,
  t2: 4 * 60,
  run: 4 * 3600 + 50 * 60,
} as const;

const SWIM_DIST_M = 3800;
const SWIM_DIST_KM = SWIM_DIST_M / 1000;
const BIKE_DIST_KM = 180;
const RUN_DIST_KM = 42.2;
const RUN_DECISION_DIST_KM = 37.5;
const RUN_DECISION_COURSE_KM = SWIM_DIST_KM + BIKE_DIST_KM + RUN_DECISION_DIST_KM;
const COURSE_MAX_KM = 221.3;
// aus der Registry abgeleitet, siehe config/raceRegistry.ts
const RUN_FRESH_MARATHON_EQUIV_SECS_BY_PREF: Record<EmpiricalPref, number> = {
  p90: 2 * 3600 + 45 * 60,
  p75: 3 * 3600 + 10 * 60,
  p50: 3 * 3600 + 40 * 60,
  p25: 4 * 3600 + 5 * 60,
  p10: 4 * 3600 + 30 * 60,
};
const BIKE_FTP_WKG_BY_PREF: Record<EmpiricalPref, number> = {
  p90: 3.8,
  p75: 3.5,
  p50: 3.1,
  p25: 2.7,
  p10: 2.4,
};
const CSS_DELTA_SEC_PER_100M = 10;

export type EmpiricalPref = (typeof PREF_OPTIONS)[number];
export type EmpiricalLegTimes = Record<"swim" | "t1" | "bike" | "t2" | "run", number>;

export type EmpiricalOverviewRow = {
  swimTime: string;
  swimPace: string;
  t1Time: string;
  bikeTime: string;
  bikePace: string;
  t2Time: string;
  runTime: string;
  runPace: string;
  timeAtDecision: string;
};

export type EmpiricalPlanModel = {
  legTimes: EmpiricalLegTimes;
  overview: EmpiricalOverviewRow;
  caption: string;
  swimExpertLabels: Record<EmpiricalPref, string>;
  bikeExpertLabels: Record<EmpiricalPref, string>;
  runExpertLabels: Record<EmpiricalPref, string>;
};

type EmpiricalSegment = {
  leg: "swim" | "bike" | "run";
  startKm: number;
  endKm: number;
  segDistKm: number;
  baseSpeedKmh: number;
  speedKmh: number;
};

type YearOption = number | "All";

function formatHms(seconds: number) {
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatSwimPace(totalSwimSeconds: number) {
  const secondsPer100m = totalSwimSeconds / (SWIM_DIST_M / 100);
  const rounded = Math.round(secondsPer100m);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")} min/100m`;
}

function formatRunPace(totalRunSeconds: number) {
  const secondsPerKm = totalRunSeconds / RUN_DIST_KM;
  const rounded = Math.round(secondsPerKm);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")} min/km`;
}

function calcBikeSpeedKmh(totalBikeSeconds: number) {
  return BIKE_DIST_KM / (totalBikeSeconds / 3600);
}

function normalizePref(value: string): EmpiricalPref {
  const lower = value.trim().toLowerCase();
  if ((PREF_OPTIONS as readonly string[]).includes(lower)) {
    return lower as EmpiricalPref;
  }
  if (lower.startsWith("weak")) {
    return "p25";
  }
  if (lower.startsWith("strong")) {
    return "p75";
  }
  return "p50";
}

function prefToFactor(pref: string) {
  return PREF_FACTORS[normalizePref(pref)];
}

function normalizeFinishType(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function isBlackFinishType(value: unknown) {
  return normalizeFinishType(value).includes("black");
}

function median(values: number[]) {
  if (values.length === 0) {
    return Number.NaN;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? Number.NaN;
  }

  const left = sorted[middle - 1];
  const right = sorted[middle];
  if (left === undefined || right === undefined) {
    return Number.NaN;
  }
  return (left + right) / 2;
}

export const EMPIRICAL_PREF_OPTIONS = PREF_OPTIONS;

export const TRAINING_LABELS_SHORT: Record<EmpiricalPref, string> = {
  p10: "Very limited",
  p25: "Limited",
  p50: "Balanced",
  p75: "More",
  p90: "Significant",
};

function formatMmSs(totalSeconds: number) {
  const rounded = Math.round(totalSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function cssLabelFromSwimTime(swimSeconds: number) {
  const raceSecondsPer100m = swimSeconds / (SWIM_DIST_M / 100);
  const cssSeconds = Math.max(0, raceSecondsPer100m - CSS_DELTA_SEC_PER_100M);
  return `${formatMmSs(cssSeconds)}/100m`;
}

function formatHm(totalSeconds: number) {
  const rounded = Math.round(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

function runMarathonLabelWithPace(pref: EmpiricalPref) {
  const marathonSeconds = RUN_FRESH_MARATHON_EQUIV_SECS_BY_PREF[pref];
  const secondsPerKm = marathonSeconds / 42.195;
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);
  return `${formatHm(marathonSeconds)} (${minutes}:${String(seconds).padStart(2, "0")}/km)`;
}

function bikeWkgLabelFromPref(pref: EmpiricalPref) {
  return `${BIKE_FTP_WKG_BY_PREF[pref].toFixed(1)} W/kg`;
}

function effectiveCutoffYears(selectedYear: YearOption) {
  if (selectedYear !== "All" && CUTOFF_37_5_YEARS.has(selectedYear)) {
    return new Set([selectedYear]);
  }
  return CUTOFF_37_5_YEARS;
}

function scaleLegsToTarget(legTimes: EmpiricalLegTimes) {
  const baselineTotal = Object.values(legTimes).reduce((sum, value) => sum + value, 0);
  const scale = TARGET_TOTAL_SECS / baselineTotal;
  return {
    swim: legTimes.swim * scale,
    t1: legTimes.t1 * scale,
    bike: legTimes.bike * scale,
    t2: legTimes.t2 * scale,
    run: legTimes.run * scale,
  } satisfies EmpiricalLegTimes;
}

function applyPrefBiases(
  baseLegTimes: EmpiricalLegTimes,
  swimPref: EmpiricalPref,
  bikePref: EmpiricalPref,
  runPref: EmpiricalPref,
) {
  const preScaled = {
    swim: baseLegTimes.swim * prefToFactor(swimPref),
    t1: baseLegTimes.t1,
    bike: baseLegTimes.bike * prefToFactor(bikePref),
    t2: baseLegTimes.t2,
    run: baseLegTimes.run * prefToFactor(runPref),
  } satisfies EmpiricalLegTimes;

  return scaleLegsToTarget(preScaled);
}

function applyPrefBiasesExplore(
  baseLegTimes: EmpiricalLegTimes,
  swimPref: EmpiricalPref,
  bikePref: EmpiricalPref,
  runPref: EmpiricalPref,
) {
  return {
    swim: baseLegTimes.swim * prefToFactor(swimPref),
    t1: baseLegTimes.t1,
    bike: baseLegTimes.bike * prefToFactor(bikePref),
    t2: baseLegTimes.t2,
    run: baseLegTimes.run * prefToFactor(runPref),
  } satisfies EmpiricalLegTimes;
}

function buildOverview(legTimes: EmpiricalLegTimes): EmpiricalOverviewRow {
  // Preserve the original Streamlit table behavior exactly, even though the label
  // refers to the 37.5 km decision point while the value is the summed plan time.
  return {
    swimTime: formatHms(legTimes.swim),
    swimPace: formatSwimPace(legTimes.swim),
    t1Time: formatHms(legTimes.t1),
    bikeTime: formatHms(legTimes.bike),
    bikePace: `${calcBikeSpeedKmh(legTimes.bike).toFixed(1)} km/h`,
    t2Time: formatHms(legTimes.t2),
    runTime: formatHms(legTimes.run),
    runPace: formatRunPace(legTimes.run),
    timeAtDecision: formatHms(
      legTimes.swim + legTimes.t1 + legTimes.bike + legTimes.t2 + legTimes.run,
    ),
  };
}

function buildBlackShirtSegmentPacing(
  longRows: LongRow[],
  legTimes: EmpiricalLegTimes,
  selectedYear: YearOption,
): EmpiricalSegment[] {
  const cutoffYears = effectiveCutoffYears(selectedYear);
  const filteredRows = longRows.filter((row) => {
    if (!cutoffYears.has(row.year)) {
      return false;
    }
    if (!isBlackFinishType(row.finish_type)) {
      return false;
    }
    if (row.leg !== "swim" && row.leg !== "bike" && row.leg !== "run") {
      return false;
    }
    if (!Number.isFinite(row.segment_speed_kmh) || !Number.isFinite(row.race_distance_km)) {
      return false;
    }
    const speed = row.segment_speed_kmh ?? Number.NaN;
    return speed >= 1 && speed <= 80;
  });

  const grouped = new Map<string, number[]>();
  for (const row of filteredRows) {
    const speed = row.segment_speed_kmh;
    const raceDistance = row.race_distance_km;
    const leg = row.leg;
    if (
      speed === undefined ||
      raceDistance === undefined ||
      (leg !== "swim" && leg !== "bike" && leg !== "run")
    ) {
      continue;
    }
    const key = `${leg}:${raceDistance}`;
    const values = grouped.get(key) ?? [];
    values.push(speed);
    grouped.set(key, values);
  }

  const legOffsets = {
    swim: 0,
    bike: SWIM_DIST_KM,
    run: SWIM_DIST_KM + BIKE_DIST_KM,
  } satisfies Record<EmpiricalSegment["leg"], number>;

  const legTimeSecs = {
    swim: 0,
    bike: 0,
    run: 0,
  } satisfies Record<EmpiricalSegment["leg"], number>;

  const segments: Omit<EmpiricalSegment, "speedKmh">[] = [];

  (["swim", "bike", "run"] as const).forEach((leg) => {
    const medians = [...grouped.entries()]
      .map(([key, values]) => {
        const [groupLeg, distanceText] = key.split(":");
        return {
          leg: groupLeg,
          raceDistanceKm: Number(distanceText),
          medianSpeedKmh: median(values),
        };
      })
      .filter(
        (entry) =>
          entry.leg === leg &&
          Number.isFinite(entry.raceDistanceKm) &&
          Number.isFinite(entry.medianSpeedKmh),
      )
      .sort((left, right) => left.raceDistanceKm - right.raceDistanceKm);

    let previousKm = legOffsets[leg];

    for (const entry of medians) {
      let currentKm = entry.raceDistanceKm;

      if (leg === "run") {
        if (previousKm >= RUN_DECISION_COURSE_KM) {
          break;
        }
        currentKm = Math.min(currentKm, RUN_DECISION_COURSE_KM);
      }

      const segmentDistanceKm = currentKm - previousKm;
      if (segmentDistanceKm <= 0) {
        previousKm = currentKm;
        continue;
      }

      const baseSpeedKmh = entry.medianSpeedKmh;
      const timeSecs = (segmentDistanceKm / baseSpeedKmh) * 3600;
      legTimeSecs[leg] += timeSecs;

      segments.push({
        leg,
        startKm: previousKm,
        endKm: currentKm,
        segDistKm: segmentDistanceKm,
        baseSpeedKmh,
      });

      previousKm = currentKm;
    }
  });

  const targetSecs = {
    swim: legTimes.swim,
    bike: legTimes.bike,
    run: legTimes.run * (RUN_DECISION_DIST_KM / RUN_DIST_KM),
  } satisfies Record<EmpiricalSegment["leg"], number>;

  const scaleFactors = {
    swim: legTimeSecs.swim > 0 ? legTimeSecs.swim / targetSecs.swim : 1,
    bike: legTimeSecs.bike > 0 ? legTimeSecs.bike / targetSecs.bike : 1,
    run: legTimeSecs.run > 0 ? legTimeSecs.run / targetSecs.run : 1,
  } satisfies Record<EmpiricalSegment["leg"], number>;

  return segments.map((segment) => ({
    ...segment,
    speedKmh: segment.baseSpeedKmh * scaleFactors[segment.leg],
  }));
}

export function buildEmpiricalDetailChart(
  longRows: LongRow[],
  courseRows: CourseProfileRow[],
  legTimes: EmpiricalLegTimes,
  selectedYear: YearOption,
): {
  data: Data[];
  layout: Partial<Layout>;
} {
  const segmentRows = buildBlackShirtSegmentPacing(longRows, legTimes, selectedYear);

  const xSpeed: Array<number | null> = [];
  const ySpeed: Array<number | null> = [];
  for (const row of segmentRows) {
    xSpeed.push(row.startKm, row.endKm, null);
    ySpeed.push(row.speedKmh, row.speedKmh, null);
  }

  const plottedCourseRows = courseRows.filter(
    (row) =>
      row.distance_km <= COURSE_MAX_KM &&
      row.elev_norseman_m !== undefined &&
      Number.isFinite(row.elev_norseman_m),
  );
  const elevationX = plottedCourseRows.map((row) => row.distance_km);
  const elevationY = plottedCourseRows.map((row) => row.elev_norseman_m ?? 0);

  const shapes: NonNullable<Layout["shapes"]> = [];
  if (elevationX.length > 1) {
    const pathParts = [`M ${elevationX[0]},${elevationY[0]}`];
    for (let index = 1; index < elevationX.length; index += 1) {
      pathParts.push(`L ${elevationX[index]},${elevationY[index]}`);
    }
    const lastX = elevationX[elevationX.length - 1];
    const firstX = elevationX[0];
    if (lastX !== undefined && firstX !== undefined) {
      pathParts.push(`L ${lastX},0`, `L ${firstX},0`, "Z");
      shapes.push({
        type: "path",
        path: pathParts.join(" "),
        xref: "x",
        yref: "y2",
        fillcolor: PALETTE.elevationFill,
        line: { color: PALETTE.elevationLine, width: 2 },
        layer: "below",
      });
    }
  }

  const splitPositions = [...new Set(longRows.map((row) => row.race_distance_km))]
    .filter(
      (value): value is number =>
        value !== undefined &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= COURSE_MAX_KM,
    )
    .sort((left, right) => left - right);
  splitPositions.forEach((position) => {
    shapes.push({
      type: "line",
      xref: "x",
      yref: "paper",
      x0: position,
      x1: position,
      y0: 0,
      y1: 1,
      line: { color: "rgba(220,220,220,0.4)", width: 1, dash: "dot" },
      layer: "below",
    });
  });

  shapes.push({
    type: "line",
    xref: "x",
    yref: "paper",
    x0: RUN_DECISION_COURSE_KM,
    x1: RUN_DECISION_COURSE_KM,
    y0: 0,
    y1: 1,
    line: { color: "white", width: 1, dash: "dash" },
    layer: "above",
  });

  const courseMaxTick = Number(COURSE_MAX_KM.toFixed(1));

  return {
    data: [
      {
        type: "scatter",
        x: elevationX,
        y: elevationY,
        yaxis: "y2",
        mode: "lines",
        name: "Course elevation",
        line: { width: 0, color: "rgba(31, 111, 178, 0)" },
        hoverinfo: "skip",
        showlegend: false,
      },
      {
        type: "scatter",
        x: xSpeed,
        y: ySpeed,
        mode: "lines",
        name: "Recommended speed (km/h)",
        line: { width: 5, color: PALETTE.accent },
        hovertemplate: "Speed: %{y:.1f} km/h<extra></extra>",
        connectgaps: false,
      },
    ],
    layout: {
      paper_bgcolor: "#7A7A7A",
      plot_bgcolor: "#7A7A7A",
      font: { color: "white", family: "IBM Plex Sans, sans-serif" },
      margin: { l: 8, r: 8, t: 24, b: 8 },
      annotations: [
        {
          x: RUN_DECISION_COURSE_KM,
          y: 1,
          xref: "x",
          yref: "paper",
          text: "Black Shirt decision ▾",
          showarrow: false,
          yshift: 12,
          xanchor: "right",
          font: { color: "white", size: 12 },
        },
      ],
      shapes,
      xaxis: {
        title: { text: "Distance (km)" },
        range: [0, COURSE_MAX_KM],
        tickmode: "array",
        tickvals: [0, 50, 100, 150, 200, COURSE_MAX_KM],
        ticktext: ["0", "50", "100", "150", "200", `${courseMaxTick}`],
        gridcolor: "rgba(0,0,0,0.15)",
        zerolinecolor: "rgba(0,0,0,0.15)",
      },
      yaxis: {
        title: { text: "Speed (km/h)" },
        gridcolor: "rgba(0,0,0,0.15)",
        zerolinecolor: "rgba(0,0,0,0.15)",
      },
      yaxis2: {
        title: { text: "Elevation (m)" },
        overlaying: "y",
        side: "right",
        gridcolor: "rgba(0,0,0,0)",
        zerolinecolor: "rgba(0,0,0,0.15)",
        rangemode: "tozero",
      },
    },
  };
}

export function buildEmpiricalPlanModel({
  swimPref,
  bikePref,
  runPref,
  exploreMode,
}: {
  swimPref: EmpiricalPref;
  bikePref: EmpiricalPref;
  runPref: EmpiricalPref;
  exploreMode: boolean;
}): EmpiricalPlanModel {
  const baseLegTimes = scaleLegsToTarget({
    swim: BASELINE_LEG_SECS.swim,
    t1: BASELINE_LEG_SECS.t1,
    bike: BASELINE_LEG_SECS.bike,
    t2: BASELINE_LEG_SECS.t2,
    run: BASELINE_LEG_SECS.run,
  });

  const legTimes = exploreMode
    ? applyPrefBiasesExplore(baseLegTimes, swimPref, bikePref, runPref)
    : applyPrefBiases(baseLegTimes, swimPref, bikePref, runPref);

  const swimExpertLabels = PREF_OPTIONS.reduce<Record<EmpiricalPref, string>>((accumulator, pref) => {
    const previewLegTimes = exploreMode
      ? applyPrefBiasesExplore(baseLegTimes, pref, bikePref, runPref)
      : applyPrefBiases(baseLegTimes, pref, bikePref, runPref);
    accumulator[pref] = cssLabelFromSwimTime(previewLegTimes.swim);
    return accumulator;
  }, {} as Record<EmpiricalPref, string>);

  const bikeExpertLabels = PREF_OPTIONS.reduce<Record<EmpiricalPref, string>>((accumulator, pref) => {
    accumulator[pref] = bikeWkgLabelFromPref(pref);
    return accumulator;
  }, {} as Record<EmpiricalPref, string>);

  const runExpertLabels = PREF_OPTIONS.reduce<Record<EmpiricalPref, string>>((accumulator, pref) => {
    accumulator[pref] = runMarathonLabelWithPace(pref);
    return accumulator;
  }, {} as Record<EmpiricalPref, string>);

  const totalTime = Object.values(legTimes).reduce((sum, value) => sum + value, 0);

  return {
    legTimes,
    overview: buildOverview(legTimes),
    caption: exploreMode
      ? `Explore mode: leg distribution is based on empirical Black Shirt medians from the years with the 37.5 km Black-Shirt cut-off, and the total time is unlocked. The current plan sums to ${formatHms(totalTime)}.`
      : `Leg distribution is based on empirical Black Shirt medians from the years with the 37.5 km Black-Shirt cut-off, scaled to a fixed target total of ${formatHms(totalTime)} (13:51).`,
    swimExpertLabels,
    bikeExpertLabels,
    runExpertLabels,
  };
}
