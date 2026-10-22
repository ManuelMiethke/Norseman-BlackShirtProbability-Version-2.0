/**
 * Rank band used to compare yourself with the athletes who fight for the last
 * Black Shirt places around the cut-off (rank 160). Change min/max here to
 * move the band, e.g. to 120–160.
 */
export const RANK_BAND = { min: 140, max: 180 } as const;

/**
 * Black Shirt target time at the 37.5 km cut-off (Stavsro): the median elapsed
 * time of rank ~160 at the cut-off over the years with the 37.5 km rule
 * (2024–2026, see "Outcome Mix" on the overview). Updated from 13:51 to 13:48
 * after adding the 2026 race. Used by the Pace Planner and the Odds tool.
 */
export const BLACK_SHIRT_TARGET_AT_CUTOFF_S = 13 * 3600 + 48 * 60;
export const RANK_BAND_GROUP = "Places 140–180" as const;

export type GroupOption =
  | "All"
  | "Top 10"
  | "Black Shirt"
  | typeof RANK_BAND_GROUP
  | "White Shirt"
  | "DNF";

export type RaceYearConfig = {
  year: number;
  cutoffRunKm: number;
  cutoffSplitKey: string;
  finishDistanceKm: number;
  startersAfterSwim: number;
  notes: string[];
};

export const GROUP_OPTIONS: GroupOption[] = [
  "All",
  "Top 10",
  "Black Shirt",
  RANK_BAND_GROUP,
  "White Shirt",
  "DNF",
];

export const RACE_YEAR_REGISTRY: Record<number, RaceYearConfig> = {
  2018: {
    year: 2018,
    cutoffRunKm: 32.5,
    cutoffSplitKey: "run_32_5km_langefonn",
    finishDistanceKm: 216.3,
    startersAfterSwim: 242,
    notes: ["32.5 km Black/White decision year"],
  },
  2019: {
    year: 2019,
    cutoffRunKm: 32.5,
    cutoffSplitKey: "run_32_5km_langefonn",
    finishDistanceKm: 216.3,
    startersAfterSwim: 261,
    notes: ["32.5 km Black/White decision year"],
  },
  2021: {
    year: 2021,
    cutoffRunKm: 32.5,
    cutoffSplitKey: "run_32_5km_langefonn",
    finishDistanceKm: 216.3,
    startersAfterSwim: 97,
    notes: ["32.5 km Black/White decision year"],
  },
  2022: {
    year: 2022,
    cutoffRunKm: 32.5,
    cutoffSplitKey: "run_32_5km_langefonn",
    finishDistanceKm: 216.3,
    startersAfterSwim: 233,
    notes: [
      "32.5 km Black/White decision year",
      "Shorter finish profile than 2024/2025.",
    ],
  },
  2024: {
    year: 2024,
    cutoffRunKm: 37.5,
    cutoffSplitKey: "run_37_5km_stavsro_cut_off",
    finishDistanceKm: 221.3,
    startersAfterSwim: 255,
    notes: ["37.5 km Black/White decision year"],
  },
  2025: {
    year: 2025,
    cutoffRunKm: 37.5,
    cutoffSplitKey: "run_37_5km_stavsro_cut_off",
    finishDistanceKm: 221.3,
    startersAfterSwim: 253,
    notes: ["37.5 km Black/White decision year"],
  },
  2026: {
    year: 2026,
    cutoffRunKm: 37.5,
    cutoffSplitKey: "run_37_5km_stavsro_cut_off",
    finishDistanceKm: 221.3,
    startersAfterSwim: 248,
    notes: [
      "37.5 km Black/White decision year",
      "Timing mat at 101 km Skurdalen largely failed; 143 splits interpolated.",
    ],
  },
};

export const CUTOFF_37_5_YEARS = new Set(
  Object.values(RACE_YEAR_REGISTRY)
    .filter((config) => config.cutoffRunKm === 37.5)
    .map((config) => config.year),
);

export const LATEST_YEAR = Math.max(
  ...Object.values(RACE_YEAR_REGISTRY).map((config) => config.year),
);

export const KNOWN_YEARS = Object.keys(RACE_YEAR_REGISTRY)
  .map((year) => Number(year))
  .sort((left, right) => right - left);
