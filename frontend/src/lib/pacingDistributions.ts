import type { Data, Layout } from "plotly.js";

import type { GroupOption } from "@/config/raceRegistry";
import {
  classifyFinishGroup,
  filterRowsByYear,
  isBlackFinishType,
  isTop10Rank,
  isWhiteFinishType,
} from "@/lib/groups";
import {
  secondsToHms,
  timeToSeconds,
} from "@/lib/time";
import type { WideRow } from "@/types/data";

type PaceMode = "min_per_100m" | "min_per_km" | "kmh" | null;
type PaceTone = "top10" | "black" | "white";
type PaceGroupKey = "Top 10" | "Black Shirt" | "White Shirt";
type PaceTimeField =
  | "swim_time"
  | "t1_time"
  | "bike_time"
  | "t2_time"
  | "run_time"
  | "zombie_hill_time"
  | "overall_time";

type PaceLegConfig = {
  id: string;
  title: string;
  field: PaceTimeField;
  distanceKm: number | null;
  mode: PaceMode;
  optional?: boolean;
};

type PreparedWideRow = WideRow & {
  isTop10: boolean;
  legSeconds: Record<PaceTimeField, number | null>;
};

type SummaryStats = {
  median: number | null;
  std: number | null;
  min: number | null;
  max: number | null;
};

type PlotFigure = {
  data: Data[];
  layout: Partial<Layout>;
};

export type PaceStatsCell = {
  group: PaceGroupKey;
  time: string;
  secondaryLines: string[];
};

type PaceStatsRow = {
  metric: string;
  cells: PaceStatsCell[];
};

type PaceStatsTable = {
  groups: Array<{
    key: PaceGroupKey;
    tone: PaceTone;
  }>;
  secondaryLabel: "Pace" | "Speed" | null;
  rows: PaceStatsRow[];
  emptyMessage: string | null;
};

export type PaceLegModel = {
  id: string;
  title: string;
  figure: PlotFigure;
  table: PaceStatsTable;
};

export type PaceDistributionModel = {
  primaryLegs: PaceLegModel[];
  zombieHill: PaceLegModel | null;
  warning: string | null;
};

const BG_GRAY = "#7a7a7a";
const OUTLINE_GRAY = "#2b2b2b";

const GROUP_CONFIG: Record<
  PaceGroupKey,
  {
    tone: PaceTone;
    fill: string;
    traceLabel: string;
  }
> = {
  "Top 10": {
    tone: "top10",
    fill: "#00ff00",
    traceLabel: "Top 10",
  },
  "Black Shirt": {
    tone: "black",
    fill: "#000000",
    traceLabel: "Black Shirt",
  },
  "White Shirt": {
    tone: "white",
    fill: "#ffffff",
    traceLabel: "White Shirt",
  },
};

const CHART_GROUP_ORDER: PaceGroupKey[] = ["Top 10", "Black Shirt", "White Shirt"];
const METRICS_ORDER = [
  { label: "Median", key: "median" },
  { label: "St. dev", key: "std" },
  { label: "Min", key: "min" },
  { label: "Max", key: "max" },
] as const;

const LEG_CONFIGS: PaceLegConfig[] = [
  {
    id: "swim",
    title: "Swim",
    field: "swim_time",
    distanceKm: 3.8,
    mode: "min_per_100m",
  },
  {
    id: "t1",
    title: "T1",
    field: "t1_time",
    distanceKm: null,
    mode: null,
  },
  {
    id: "bike",
    title: "Bike",
    field: "bike_time",
    distanceKm: 180,
    mode: "kmh",
  },
  {
    id: "t2",
    title: "T2",
    field: "t2_time",
    distanceKm: null,
    mode: null,
  },
  {
    id: "run",
    title: "Run",
    field: "run_time",
    distanceKm: 42.2,
    mode: "min_per_km",
  },
  {
    id: "zombie_hill",
    title: "Zombie Hill",
    field: "zombie_hill_time",
    distanceKm: 7.5,
    mode: "min_per_km",
    optional: true,
  },
  {
    id: "overall",
    title: "Total",
    field: "overall_time",
    distanceKm: 3.8 + 180 + 42.2,
    mode: "kmh",
  },
];

function isFiniteNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function isTop10(row: WideRow) {
  return isTop10Rank(row.overall_rank);
}

function toPreparedRows(rows: WideRow[], selectedYear: number | "All"): PreparedWideRow[] {
  return filterRowsByYear(rows, selectedYear).map((row) => ({
    ...row,
    isTop10: isTop10(row),
    legSeconds: {
      swim_time: timeToSeconds(row.swim_time),
      t1_time: timeToSeconds(row.t1_time),
      bike_time: timeToSeconds(row.bike_time),
      t2_time: timeToSeconds(row.t2_time),
      run_time: timeToSeconds(row.run_time),
      zombie_hill_time: timeToSeconds(row.zombie_hill_time),
      overall_time: timeToSeconds(row.overall_time),
    },
  }));
}

function groupForChart(row: PreparedWideRow): PaceGroupKey | null {
  const group = classifyFinishGroup(row);
  return group === "Top 10" || group === "Black Shirt" || group === "White Shirt" ? group : null;
}

function summarize(values: number[]): SummaryStats {
  if (values.length === 0) {
    return {
      median: null,
      std: null,
      min: null,
      max: null,
    };
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  const variance =
    sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / sorted.length;

  return {
    median,
    std: Math.sqrt(variance),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

function paceValueFromTime(
  timeSeconds: number | null,
  distanceKm: number | null,
  mode: PaceMode,
) {
  if (!isFiniteNumber(timeSeconds) || !isFiniteNumber(distanceKm) || !mode) {
    return null;
  }

  if (mode === "min_per_100m") {
    const distanceInHundreds = distanceKm * 10;
    if (distanceInHundreds <= 0) {
      return null;
    }
    return timeSeconds / distanceInHundreds;
  }

  if (mode === "min_per_km") {
    if (distanceKm <= 0) {
      return null;
    }
    return timeSeconds / distanceKm;
  }

  const hours = timeSeconds / 3600;
  if (hours <= 0) {
    return null;
  }
  return distanceKm / hours;
}

function paceToString(value: number | null, mode: Exclude<PaceMode, null>) {
  if (!isFiniteNumber(value)) {
    return "";
  }

  if (mode === "kmh") {
    return `${value.toFixed(1)} km/h`;
  }

  const rounded = Math.round(value);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  const unit = mode === "min_per_100m" ? "min/100m" : "min/km";
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")} ${unit}`;
}

function speedLinesForMetric(
  stats: SummaryStats,
  metricKey: (typeof METRICS_ORDER)[number]["key"],
  distanceKm: number | null,
  mode: PaceMode,
) {
  if (!mode || !isFiniteNumber(distanceKm)) {
    return [];
  }

  if (metricKey === "median" || metricKey === "min" || metricKey === "max") {
    const formatted = paceToString(
      paceValueFromTime(stats[metricKey], distanceKm, mode),
      mode,
    );
    return formatted ? [formatted] : [];
  }

  if (!isFiniteNumber(stats.median) || !isFiniteNumber(stats.std)) {
    return [];
  }

  const slowerTime = stats.median + stats.std;
  const fasterTime = Math.max(stats.median - stats.std, 1);
  const slower = paceToString(paceValueFromTime(slowerTime, distanceKm, mode), mode);
  const faster = paceToString(paceValueFromTime(fasterTime, distanceKm, mode), mode);

  return [slower ? `+ ${slower}` : "", faster ? `- ${faster}` : ""].filter(Boolean);
}

function statsGroupsForSelection(selectedGroup: GroupOption): PaceGroupKey[] {
  if (selectedGroup === "All") {
    return CHART_GROUP_ORDER;
  }
  if (selectedGroup === "Top 10") {
    return ["Top 10"];
  }
  if (selectedGroup === "Black Shirt") {
    return ["Black Shirt"];
  }
  if (selectedGroup === "White Shirt") {
    return ["White Shirt"];
  }
  return [];
}

function rowsForStatsGroup(rows: PreparedWideRow[], group: PaceGroupKey) {
  if (group === "Top 10") {
    return rows.filter((row) => row.isTop10);
  }
  if (group === "Black Shirt") {
    return rows.filter((row) => isBlackFinishType(row.finish_type));
  }
  return rows.filter((row) => isWhiteFinishType(row.finish_type));
}

function secondaryColumnLabel(mode: PaceMode) {
  if (!mode) {
    return null;
  }
  return mode === "kmh" ? "Speed" : "Pace";
}

function buildFigure(rows: PreparedWideRow[], config: PaceLegConfig): PlotFigure {
  const traces: Data[] = [];

  for (const group of CHART_GROUP_ORDER) {
    const samples = rows
      .filter((row) => groupForChart(row) === group)
      .map((row) => row.legSeconds[config.field])
      .filter(isFiniteNumber);

    if (samples.length === 0) {
      continue;
    }

    traces.push({
      type: "box",
      name: GROUP_CONFIG[group].traceLabel,
      y: samples.map((value) => value / 3600),
      boxmean: false,
      boxpoints: "outliers",
      fillcolor: GROUP_CONFIG[group].fill,
      line: {
        color: OUTLINE_GRAY,
        width: 2,
      },
      marker: {
        color: OUTLINE_GRAY,
        size: 6,
        opacity: 0.9,
      },
      customdata: samples.map((value) => [secondsToHms(value)]),
      hovertemplate: `<b>${GROUP_CONFIG[group].traceLabel}</b><br>Time: %{customdata[0]}<extra></extra>`,
    } as Data);
  }

  return {
    data: traces,
    layout: {
      title: {
        text: config.title,
      },
      paper_bgcolor: BG_GRAY,
      plot_bgcolor: BG_GRAY,
      font: {
        color: "#ffffff",
      },
      height: 280,
      margin: {
        l: 44,
        r: 14,
        t: 44,
        b: 12,
      },
      showlegend: false,
      annotations:
        traces.length > 0
          ? undefined
          : [
              {
                text: "No data",
                x: 0.5,
                y: 0.5,
                xref: "paper",
                yref: "paper",
                showarrow: false,
                font: {
                  color: "#ffffff",
                  size: 14,
                },
              },
            ],
      xaxis: {
        title: {
          text: "",
          font: {
            color: "#ffffff",
          },
        },
        gridcolor: "rgba(0,0,0,0.18)",
        tickfont: {
          color: "#ffffff",
        },
      },
      yaxis: {
        title: {
          text: "Time (h)",
          font: {
            color: "#ffffff",
          },
          standoff: 8,
        },
        gridcolor: "rgba(0,0,0,0.18)",
        zerolinecolor: "rgba(0,0,0,0.18)",
        tickfont: {
          color: "#ffffff",
        },
        automargin: true,
      },
    },
  };
}

function buildTable(
  rows: PreparedWideRow[],
  config: PaceLegConfig,
  selectedGroup: GroupOption,
): PaceStatsTable {
  const groups = statsGroupsForSelection(selectedGroup);
  if (groups.length === 0) {
    return {
      groups: [],
      secondaryLabel: secondaryColumnLabel(config.mode),
      rows: [],
      emptyMessage:
        "DNF athletes are intentionally removed from the pace summary tables, matching the original module.",
    };
  }

  const rowsByGroup = new Map<PaceGroupKey, SummaryStats>(
    groups.map((group) => [
      group,
      summarize(
        rowsForStatsGroup(rows, group)
          .map((row) => row.legSeconds[config.field])
          .filter(isFiniteNumber),
      ),
    ]),
  );

  return {
    groups: groups.map((group) => ({
      key: group,
      tone: GROUP_CONFIG[group].tone,
    })),
    secondaryLabel: secondaryColumnLabel(config.mode),
    emptyMessage: null,
    rows: METRICS_ORDER.map((metric) => ({
      metric: metric.label,
      cells: groups.map((group) => {
        const stats = rowsByGroup.get(group) ?? summarize([]);
        return {
          group,
          time: secondsToHms(stats[metric.key]),
          secondaryLines: speedLinesForMetric(
            stats,
            metric.key,
            config.distanceKm,
            config.mode,
          ),
        };
      }),
    })),
  };
}

function buildLegModel(
  rows: PreparedWideRow[],
  config: PaceLegConfig,
  selectedGroup: GroupOption,
): PaceLegModel {
  return {
    id: config.id,
    title: config.title,
    figure: buildFigure(rows, config),
    table: buildTable(rows, config, selectedGroup),
  };
}

export function buildPaceDistributionModel(
  rows: WideRow[],
  selectedYear: number | "All",
  selectedGroup: GroupOption,
): PaceDistributionModel {
  const preparedRows = toPreparedRows(rows, selectedYear);
  const availableConfigs = LEG_CONFIGS.filter((config) =>
    preparedRows.some((row) => isFiniteNumber(row.legSeconds[config.field])),
  );

  if (availableConfigs.length === 0) {
    return {
      primaryLegs: [],
      zombieHill: null,
      warning: "No usable pace timing data is available for the selected year filter.",
    };
  }

  const primaryConfigs = availableConfigs.filter((config) => !config.optional);
  const zombieConfig =
    availableConfigs.find((config) => config.id === "zombie_hill") ?? null;

  return {
    primaryLegs: primaryConfigs.map((config) =>
      buildLegModel(preparedRows, config, selectedGroup),
    ),
    zombieHill: zombieConfig
      ? buildLegModel(preparedRows, zombieConfig, selectedGroup)
      : null,
    warning: null,
  };
}
