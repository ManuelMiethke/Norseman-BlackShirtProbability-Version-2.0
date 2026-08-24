import type { Data, Layout } from "plotly.js";

import {
  RACE_YEAR_REGISTRY,
  type GroupOption,
} from "@/config/raceRegistry";
import {
  classifyFinishGroup,
  filterRowsByYear,
} from "@/lib/groups";
import type { LongRow } from "@/types/data";

type HeatmapCategory = "Top 10" | "Black Shirt" | "White Shirt" | "DNF";

type PlotFigure = {
  data: Data[];
  layout: Partial<Layout>;
};

type PreparedHeatmapRow = LongRow & {
  athleteKey: string;
  category: HeatmapCategory;
  overallRankNum: number | null;
  segmentTimeSeconds: number | null;
};

type AthleteMeta = {
  athleteKey: string;
  bib: number;
  year: number;
  category: HeatmapCategory;
  overallRankNum: number | null;
};

export type PacingHeatmapModel = {
  figure: PlotFigure | null;
  warning: string | null;
};

const CATEGORY_ORDER: HeatmapCategory[] = [
  "Top 10",
  "Black Shirt",
  "White Shirt",
  "DNF",
];

const DROP_SPLITS = new Set([
  "transition_1_in",
  "bike_start",
  "run_start",
  "bike_152km_end_imingfjell",
]);

const FINISH_SPLITS = new Set([
  "finish_black_t_shirt",
  "finish_white_t_shirt",
]);

const COLOR_SCALE: Array<[number, string]> = [
  [0.0, "#8c2d04"],
  [0.1, "#cc4c02"],
  [0.2, "#ec7014"],
  [0.3, "#fe9929"],
  [0.4, "#fec44f"],
  [0.5, "#f7f7f7"],
  [0.6, "#c6dbef"],
  [0.7, "#9ecae1"],
  [0.8, "#6baed6"],
  [0.9, "#3182bd"],
  [1.0, "#08519c"],
];

function isFiniteNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function median(values: number[]) {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function robustAbsMax(values: number[]) {
  if (values.length === 0) {
    return 1;
  }
  const sorted = [...values]
    .map((value) => Math.abs(value))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  if (sorted.length === 0) {
    return 1;
  }
  const index = Math.min(sorted.length - 1, Math.floor(0.9 * (sorted.length - 1)));
  return sorted[index];
}

function toCategory(row: LongRow): HeatmapCategory | null {
  const group = classifyFinishGroup(row);
  return group === "Other" ? null : group;
}

function matchesSelectedGroup(category: HeatmapCategory, selectedGroup: GroupOption) {
  return selectedGroup === "All" || category === selectedGroup;
}

function keepByYearCutoff(row: LongRow) {
  if (!String(row.split_key ?? "").startsWith("run_")) {
    return true;
  }
  if (!isFiniteNumber(row.race_distance_km)) {
    return true;
  }
  const config = RACE_YEAR_REGISTRY[row.year];
  if (!config) {
    return true;
  }
  return row.race_distance_km <= config.finishDistanceKm;
}

function buildHoverLabel(meta: AthleteMeta) {
  const rankPart = meta.overallRankNum ? ` • Rank ${meta.overallRankNum}` : "";
  return `${meta.category} • Bib ${meta.bib} • ${meta.year}${rankPart}`;
}

function buildSplitOrder(rows: PreparedHeatmapRow[]) {
  const distances = new Map<string, number[]>();
  for (const row of rows) {
    if (!isFiniteNumber(row.race_distance_km)) {
      continue;
    }
    const bucket = distances.get(row.split_key) ?? [];
    bucket.push(row.race_distance_km);
    distances.set(row.split_key, bucket);
  }

  return [...new Set(rows.map((row) => row.split_key))]
    .map((splitKey) => ({
      splitKey,
      distance: median(distances.get(splitKey) ?? []),
    }))
    .sort((left, right) => {
      if (left.distance === null && right.distance === null) {
        return left.splitKey.localeCompare(right.splitKey);
      }
      if (left.distance === null) {
        return 1;
      }
      if (right.distance === null) {
        return -1;
      }
      return left.distance - right.distance;
    })
    .map((entry) => entry.splitKey);
}

function buildMatrix(
  rows: PreparedHeatmapRow[],
  splitOrder: string[],
  athleteOrder: string[],
  athleteMeta: Map<string, AthleteMeta>,
) {
  const splitMedians = new Map<string, number>();
  for (const splitKey of splitOrder) {
    const splitMedian = median(
      rows
        .filter((row) => row.split_key === splitKey)
        .map((row) => row.segmentTimeSeconds)
        .filter(isFiniteNumber),
    );
    if (isFiniteNumber(splitMedian) && splitMedian !== 0) {
      splitMedians.set(splitKey, splitMedian);
    }
  }

  const deltaMap = new Map<string, Map<string, number>>();
  const hoverMap = new Map<string, Map<string, string>>();

  for (const row of rows) {
    if (!isFiniteNumber(row.segmentTimeSeconds)) {
      continue;
    }
    const splitMedian = splitMedians.get(row.split_key);
    if (!isFiniteNumber(splitMedian) || splitMedian === 0) {
      continue;
    }
    const deltaPct = ((row.segmentTimeSeconds - splitMedian) / splitMedian) * 100;
    const splitValues = deltaMap.get(row.split_key) ?? new Map<string, number>();
    splitValues.set(row.athleteKey, deltaPct);
    deltaMap.set(row.split_key, splitValues);

    const splitHover = hoverMap.get(row.split_key) ?? new Map<string, string>();
    splitHover.set(row.athleteKey, buildHoverLabel(athleteMeta.get(row.athleteKey)!));
    hoverMap.set(row.split_key, splitHover);
  }

  const z = splitOrder.map((splitKey) =>
    athleteOrder.map((athleteKey) => deltaMap.get(splitKey)?.get(athleteKey) ?? null),
  );
  const customdata = splitOrder.map((splitKey) =>
    athleteOrder.map((athleteKey) => hoverMap.get(splitKey)?.get(athleteKey) ?? ""),
  );

  return {
    z,
    customdata,
  };
}

export function buildPacingHeatmapModel(
  rows: LongRow[],
  selectedYear: number | "All",
  selectedGroup: GroupOption,
): PacingHeatmapModel {
  // The heatmap is one row per split and one column per athlete, so combining
  // every race year makes it far too dense to read. Always render a single
  // year: the selected one, or the latest available year when "All" is picked.
  const effectiveYear =
    selectedYear === "All"
      ? Math.max(...rows.map((row) => Number(row.year)).filter((year) => Number.isFinite(year)))
      : selectedYear;

  const preparedRows = filterRowsByYear(rows, effectiveYear)
    .map((row) => {
      const category = toCategory(row);
      const segmentTimeSeconds =
        row.split_key === "swim_finish"
          ? (row.cum_time_seconds ?? row.segment_time_s ?? null)
          : (row.segment_time_s ?? null);
      const overallRankNum = Number(row.overall_rank ?? Number.NaN);

      return category
        ? ({
            ...row,
            athleteKey: `${category} | ${row.bib} | ${row.year}`,
            category,
            overallRankNum: Number.isFinite(overallRankNum) ? overallRankNum : null,
            segmentTimeSeconds: isFiniteNumber(segmentTimeSeconds) ? segmentTimeSeconds : null,
          } satisfies PreparedHeatmapRow)
        : null;
    })
    .filter((row): row is PreparedHeatmapRow => row !== null)
    .filter((row) => matchesSelectedGroup(row.category, selectedGroup))
    .filter((row) => !FINISH_SPLITS.has(row.split_key))
    .filter((row) => keepByYearCutoff(row))
    .filter((row) => !DROP_SPLITS.has(row.split_key));

  if (preparedRows.length === 0) {
    return {
      figure: null,
      warning: "No pacing heatmap data is available for the current year/group filter selection.",
    };
  }

  const splitOrder = buildSplitOrder(preparedRows);
  const athleteMetaMap = new Map<string, AthleteMeta>();
  for (const row of preparedRows) {
    athleteMetaMap.set(row.athleteKey, {
      athleteKey: row.athleteKey,
      bib: row.bib,
      year: row.year,
      category: row.category,
      overallRankNum: row.overallRankNum,
    });
  }

  const athleteOrder = [...athleteMetaMap.values()]
    .sort((left, right) => {
      const categoryDelta =
        CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category);
      if (categoryDelta !== 0) {
        return categoryDelta;
      }
      const leftRank = left.overallRankNum ?? Number.POSITIVE_INFINITY;
      const rightRank = right.overallRankNum ?? Number.POSITIVE_INFINITY;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return left.athleteKey.localeCompare(right.athleteKey);
    })
    .map((meta) => meta.athleteKey);

  const { z, customdata } = buildMatrix(
    preparedRows,
    splitOrder,
    athleteOrder,
    athleteMetaMap,
  );

  const athleteMetaList = athleteOrder
    .map((athleteKey) => athleteMetaMap.get(athleteKey))
    .filter((meta): meta is AthleteMeta => Boolean(meta));

  const counts = athleteMetaList.reduce<Record<HeatmapCategory, number>>(
    (accumulator, meta) => ({
      ...accumulator,
      [meta.category]: (accumulator[meta.category] ?? 0) + 1,
    }),
    {
      "Top 10": 0,
      "Black Shirt": 0,
      "White Shirt": 0,
      DNF: 0,
    },
  );

  const nonDnfColumns = athleteMetaList
    .map((meta, index) => (meta.category === "DNF" ? null : index))
    .filter((value): value is number => value !== null);
  const scaleValues = splitOrder.flatMap((_, rowIndex) =>
    (nonDnfColumns.length > 0 ? nonDnfColumns : athleteOrder.map((__, columnIndex) => columnIndex))
      .map((columnIndex) => z[rowIndex]?.[columnIndex])
      .filter(isFiniteNumber),
  );
  const absMax = Math.min(Math.max(robustAbsMax(scaleValues), 8), 30);

  const tickvals: string[] = [];
  const ticktext: string[] = [];
  const boundaryKeys: string[] = [];
  for (const category of CATEGORY_ORDER) {
    const categoryAthletes = athleteMetaList.filter((meta) => meta.category === category);
    if (categoryAthletes.length === 0) {
      continue;
    }
    tickvals.push(categoryAthletes[Math.floor(categoryAthletes.length / 2)].athleteKey);
    ticktext.push(category);
    if (tickvals.length > 1) {
      boundaryKeys.push(categoryAthletes[0].athleteKey);
    }
  }

  return {
    figure: {
      data: [
        {
          type: "heatmap",
          z,
          x: athleteOrder,
          y: splitOrder,
          customdata,
          zmin: -absMax,
          zmax: absMax,
          colorscale: COLOR_SCALE,
          colorbar: {
            title: {
              text: "Δ Time (%) vs. Median",
              font: { color: "#ffffff" },
            },
            tickfont: { color: "#ffffff" },
          },
          hoverongaps: false,
          zsmooth: false,
          hovertemplate:
            "<b>%{customdata}</b><br>Split: %{y}<br>Δ vs. Median: %{z:.1f}%<extra></extra>",
        } as Data,
      ],
      layout: {
        height: 850,
        paper_bgcolor: "#7A7A7A",
        plot_bgcolor: "#7A7A7A",
        font: { color: "#ffffff" },
        margin: {
          l: 60,
          r: 20,
          t: 12,
          b: 140,
        },
        xaxis: {
          title: {
            text:
              `Athletes ${effectiveYear} (Top 10: ${counts["Top 10"]} | ` +
              `Black Shirt: ${counts["Black Shirt"]} | ` +
              `White Shirt: ${counts["White Shirt"]} | ` +
              `DNF: ${counts.DNF})`,
            font: { color: "#ffffff" },
          },
          tickmode: "array",
          tickvals,
          ticktext,
          tickangle: 0,
          automargin: true,
          tickfont: { color: "#ffffff" },
        },
        yaxis: {
          title: {
            text: "Split",
            font: { color: "#ffffff" },
          },
          automargin: true,
          tickfont: { color: "#ffffff" },
        },
        shapes: boundaryKeys.map((athleteKey) => ({
          type: "line",
          xref: "x",
          yref: "paper",
          x0: athleteKey,
          x1: athleteKey,
          y0: 0,
          y1: 1,
          line: {
            color: "#111111",
            width: 2,
          },
          layer: "above",
        })),
      },
    },
    warning: null,
  };
}
