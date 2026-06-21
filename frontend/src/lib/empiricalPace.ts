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
const BIKE_DIST_KM = 180;
const RUN_DIST_KM = 42.2;
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
      ? `Explore mode: leg distribution is based on empirical Black Shirt medians from 2024/2025 with the 37.5 km Black-Shirt cut-off, and the total time is unlocked. The current plan sums to ${formatHms(totalTime)}.`
      : `Leg distribution is based on empirical Black Shirt medians from 2024/2025 with the 37.5 km Black-Shirt cut-off, scaled to a fixed target total of ${formatHms(totalTime)} (13:51).`,
    swimExpertLabels,
    bikeExpertLabels,
    runExpertLabels,
  };
}
