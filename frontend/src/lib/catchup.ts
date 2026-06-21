import type { ModelRow } from "@/types/data";

const SWIM_DIST_KM = 3.8;
const BIKE_DIST_KM = 180;
const RUN_STAVSRO_DIST_KM = 37.5;
const TOTAL_STAVSRO_DIST_AFTER_SWIM = BIKE_DIST_KM + RUN_STAVSRO_DIST_KM;
const STAVSRO_CUTOFF_TIME_S = 13 * 3600 + 51 * 60;
const T2_FIXED_TIME_S = 4 * 60;
const RUN_ALERT_PACE_MIN_PER_KM = 5.5;

type EmpiricalParams = {
  runPaceMedianMinPerKm: number;
  bikeSpeedMedianKmh: number;
  targetStavsroTimeSeconds: number;
};

export type CatchupComputation = {
  kmAfterSwim: number | null;
  currentTimeSeconds: number | null;
  kmError: string | null;
  timeError: string | null;
  probabilityModel: number | null;
  probabilityEmpirical: number | null;
  sampleSize: number;
  leg: "bike" | "run" | "pre_swim" | "beyond" | null;
  bikeSpeedRequired: number | null;
  runPaceRequired: number | null;
  infeasible: boolean;
  runTooFast: boolean;
};

function isFiniteNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function median(values: number[]) {
  if (values.length === 0) {
    return Number.NaN;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function parseTimeToSeconds(value: string) {
  const text = value.trim();
  if (!text) {
    return null;
  }

  const parts = text.split(":");
  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  if (parts.length === 2) {
    hours = Number(parts[0]);
    minutes = Number(parts[1]);
  } else if (parts.length === 3) {
    hours = Number(parts[0]);
    minutes = Number(parts[1]);
    seconds = Number(parts[2]);
  } else {
    throw new Error("Please use the format hh:mm (or hh:mm:ss).");
  }

  if (![hours, minutes, seconds].every(Number.isFinite)) {
    throw new Error("Please use the format hh:mm (or hh:mm:ss).");
  }

  return hours * 3600 + minutes * 60 + seconds;
}

export function formatPaceMinPerKm(pace: number | null) {
  if (!isFiniteNumber(pace)) {
    return "–";
  }
  if (pace <= 0) {
    return "0:00 min/km";
  }
  const totalSeconds = Math.round(pace * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")} min/km`;
}

export function formatSpeedKmh(speed: number | null) {
  if (!isFiniteNumber(speed)) {
    return "–";
  }
  if (speed === Number.POSITIVE_INFINITY) {
    return "∞ km/h";
  }
  if (speed <= 0) {
    return "–";
  }
  return `${speed.toFixed(1)} km/h`;
}

export function prepareCatchupRows(rows: ModelRow[], selectedYear: number | "All") {
  return rows
    .filter((row) => selectedYear === "All" || row.year === selectedYear)
    .map((row) => ({
      ...row,
      p_black: isFiniteNumber(row.p_black) ? row.p_black : null,
      y_true: isFiniteNumber(row.y_true) ? row.y_true : null,
      race_distance_km: isFiniteNumber(row.race_distance_km) ? row.race_distance_km : null,
      cum_time_seconds: isFiniteNumber(row.cum_time_seconds) ? row.cum_time_seconds : null,
      segment_speed_kmh: isFiniteNumber(row.segment_speed_kmh) ? row.segment_speed_kmh : null,
    }))
    .filter(
      (row) =>
        row.p_black !== null &&
        row.y_true !== null &&
        row.race_distance_km !== null &&
        row.cum_time_seconds !== null,
    );
}

export function computeEmpiricalParameters(rows: ReturnType<typeof prepareCatchupRows>): EmpiricalParams {
  if (rows.length === 0) {
    return {
      runPaceMedianMinPerKm: Number.NaN,
      bikeSpeedMedianKmh: Number.NaN,
      targetStavsroTimeSeconds: STAVSRO_CUTOFF_TIME_S,
    };
  }

  const blackRows = rows.filter((row) => row.finish_type.toLowerCase() === "black");

  const runSpeeds = blackRows
    .filter((row) => row.leg.toLowerCase() === "run" && isFiniteNumber(row.segment_speed_kmh))
    .map((row) => row.segment_speed_kmh!)
    .filter((speed) => speed > 0);
  const runPaces = runSpeeds.map((speed) => 60 / speed);

  const bikeSpeeds = blackRows
    .filter((row) => row.leg.toLowerCase() === "bike" && isFiniteNumber(row.segment_speed_kmh))
    .map((row) => row.segment_speed_kmh!)
    .filter((speed) => speed > 0);

  return {
    runPaceMedianMinPerKm: median(runPaces),
    bikeSpeedMedianKmh: median(bikeSpeeds),
    targetStavsroTimeSeconds: STAVSRO_CUTOFF_TIME_S,
  };
}

export function estimateBlackShirtProbability(
  rows: ReturnType<typeof prepareCatchupRows>,
  raceKm: number,
  currentTimeSeconds: number,
) {
  if (rows.length === 0) {
    return {
      probabilityModel: Number.NaN,
      probabilityEmpirical: Number.NaN,
      sampleSize: 0,
    };
  }

  const kmScale = 5;
  const timeScale = 1800;
  const nearest = rows
    .map((row) => ({
      row,
      distanceScore:
        ((row.race_distance_km! - raceKm) / kmScale) ** 2 +
        ((row.cum_time_seconds! - currentTimeSeconds) / timeScale) ** 2,
    }))
    .sort((left, right) => left.distanceScore - right.distanceScore)
    .slice(0, Math.min(80, rows.length))
    .map((entry) => entry.row);

  const probabilityModel =
    nearest.reduce((sum, row) => sum + row.p_black!, 0) / nearest.length;
  const probabilityEmpirical =
    nearest.reduce((sum, row) => sum + row.y_true!, 0) / nearest.length;

  return {
    probabilityModel: Number.isFinite(probabilityModel)
      ? probabilityModel
      : rows.reduce((sum, row) => sum + row.p_black!, 0) / rows.length,
    probabilityEmpirical: Number.isFinite(probabilityEmpirical)
      ? probabilityEmpirical
      : rows.reduce((sum, row) => sum + row.y_true!, 0) / rows.length,
    sampleSize: nearest.length,
  };
}

export function computeRequiredPaces(
  kmAfterSwim: number,
  currentTimeSeconds: number,
  bikeSpeedMedianKmh: number,
  runPaceMedianMinPerKm: number,
  targetStavsroTimeSeconds: number,
) {
  let remainingTimeSeconds = targetStavsroTimeSeconds - currentTimeSeconds;

  if (kmAfterSwim < 0) {
    return {
      leg: "pre_swim" as const,
      bikeSpeedRequired: null,
      runPaceRequired: null,
      infeasible: true,
    };
  }

  let leg: "bike" | "run" | "beyond";
  let remainingBikeKm = 0;
  let remainingRunKm = 0;

  if (kmAfterSwim < BIKE_DIST_KM) {
    leg = "bike";
    remainingTimeSeconds -= T2_FIXED_TIME_S;
    remainingBikeKm = BIKE_DIST_KM - kmAfterSwim;
    remainingRunKm = RUN_STAVSRO_DIST_KM;
  } else if (kmAfterSwim <= TOTAL_STAVSRO_DIST_AFTER_SWIM) {
    leg = "run";
    remainingRunKm = Math.max(0, RUN_STAVSRO_DIST_KM - (kmAfterSwim - BIKE_DIST_KM));
  } else {
    return {
      leg: "beyond" as const,
      bikeSpeedRequired: null,
      runPaceRequired: null,
      infeasible: true,
    };
  }

  if (remainingTimeSeconds <= 0 || remainingRunKm < 0) {
    return {
      leg,
      bikeSpeedRequired: null,
      runPaceRequired: null,
      infeasible: true,
    };
  }

  let bikeMedianTimeSeconds = 0;
  if (remainingBikeKm > 0 && isFiniteNumber(bikeSpeedMedianKmh) && bikeSpeedMedianKmh > 0) {
    bikeMedianTimeSeconds = (remainingBikeKm / bikeSpeedMedianKmh) * 3600;
  }

  if (!isFiniteNumber(runPaceMedianMinPerKm) || runPaceMedianMinPerKm <= 0) {
    return {
      leg,
      bikeSpeedRequired: null,
      runPaceRequired: null,
      infeasible: true,
    };
  }

  const runMedianTimeSeconds = remainingRunKm * runPaceMedianMinPerKm * 60;
  const totalMedianTimeSeconds = bikeMedianTimeSeconds + runMedianTimeSeconds;
  if (totalMedianTimeSeconds <= 0) {
    return {
      leg,
      bikeSpeedRequired: null,
      runPaceRequired: null,
      infeasible: true,
    };
  }

  const factor = remainingTimeSeconds / totalMedianTimeSeconds;
  return {
    leg,
    bikeSpeedRequired:
      remainingBikeKm > 0 && isFiniteNumber(bikeSpeedMedianKmh) && bikeSpeedMedianKmh > 0
        ? bikeSpeedMedianKmh / factor
        : null,
    runPaceRequired: runPaceMedianMinPerKm * factor,
    infeasible: factor < 0.7,
  };
}

export function computeCatchup(
  rows: ReturnType<typeof prepareCatchupRows>,
  empirical: EmpiricalParams,
  bikeInput: string,
  runInput: string,
  timeInput: string,
): CatchupComputation {
  let kmError: string | null = null;
  let timeError: string | null = null;
  let bikeKmDone: number | null = null;
  let runKmDone: number | null = null;
  let currentTimeSeconds: number | null = null;
  let kmAfterSwim: number | null = null;

  if (bikeInput.trim()) {
    const parsed = Number(bikeInput);
    if (!Number.isInteger(parsed)) {
      kmError = "Please enter whole numbers (e.g. Bike: 50 or Run: 5).";
    } else {
      bikeKmDone = parsed;
    }
  }

  if (runInput.trim()) {
    const parsed = Number(runInput);
    if (!Number.isInteger(parsed)) {
      kmError = "Please enter whole numbers (e.g. Bike: 50 or Run: 5).";
    } else {
      runKmDone = parsed;
    }
  }

  if (timeInput.trim()) {
    try {
      currentTimeSeconds = parseTimeToSeconds(timeInput);
    } catch (error) {
      timeError = error instanceof Error ? error.message : "Please use the format hh:mm.";
    }
  }

  if (bikeKmDone !== null && runKmDone !== null) {
    kmError = "Please fill in either Bike km OR Run km (not both).";
  } else if (bikeKmDone !== null) {
    kmAfterSwim = bikeKmDone;
  } else if (runKmDone !== null) {
    kmAfterSwim = BIKE_DIST_KM + runKmDone;
  }

  if (kmError || timeError || kmAfterSwim === null || currentTimeSeconds === null) {
    return {
      kmAfterSwim,
      currentTimeSeconds,
      kmError,
      timeError,
      probabilityModel: null,
      probabilityEmpirical: null,
      sampleSize: 0,
      leg: null,
      bikeSpeedRequired: null,
      runPaceRequired: null,
      infeasible: false,
      runTooFast: false,
    };
  }

  const probability = estimateBlackShirtProbability(
    rows,
    SWIM_DIST_KM + kmAfterSwim,
    currentTimeSeconds,
  );
  const requiredPaces = computeRequiredPaces(
    kmAfterSwim,
    currentTimeSeconds,
    empirical.bikeSpeedMedianKmh,
    empirical.runPaceMedianMinPerKm,
    empirical.targetStavsroTimeSeconds,
  );
  const runTooFast =
    requiredPaces.runPaceRequired !== null &&
    Number.isFinite(requiredPaces.runPaceRequired) &&
    requiredPaces.runPaceRequired < RUN_ALERT_PACE_MIN_PER_KM;

  return {
    kmAfterSwim,
    currentTimeSeconds,
    kmError,
    timeError,
    probabilityModel: probability.probabilityModel,
    probabilityEmpirical: probability.probabilityEmpirical,
    sampleSize: probability.sampleSize,
    leg: requiredPaces.leg,
    bikeSpeedRequired: requiredPaces.bikeSpeedRequired,
    runPaceRequired: requiredPaces.runPaceRequired,
    infeasible: requiredPaces.infeasible,
    runTooFast,
  };
}
