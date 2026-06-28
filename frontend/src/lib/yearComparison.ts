import type { Data, Layout } from "plotly.js";

import type { GroupOption } from "@/config/raceRegistry";
import { filterRowsByGroup } from "@/lib/groups";
import { secondsToHms, secondsToPaddedHms, timeToSeconds } from "@/lib/time";
import type { WideRow } from "@/types/data";

const LEG_ORDER = ["Swim", "Bike", "Run (to 32.5 km)"] as const;
const SEGMENT_COLORS = {
  Swim: "#64b5f6",
  Bike: "#4A4A4A",
  "Run (to 32.5 km)": "#2e7d32",
} as const;
const BASELINE_YEAR = 2025;

type Leg = (typeof LEG_ORDER)[number];

type YearMedianRow = {
  year: number;
  leg: Leg;
  medianSeconds: number;
};

type ComparisonFigure = {
  data: Data[];
  layout: Partial<Layout>;
  previewLayout?: Partial<Layout>;
};

export type YearComparisonMode = "Time Overview" | "Compared to 2025";

export type ComparisonTableRow = {
  year: number;
  swim: string;
  bike: string;
  runTo325Km: string;
};

export type YearComparisonModel = {
  comparisonFigure: ComparisonFigure | null;
  overallFigure: ComparisonFigure | null;
  tableRows: ComparisonTableRow[];
  warning: string | null;
  comparisonWarning: string | null;
  overallWarning: string | null;
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

function toLegMedianRows(rows: WideRow[]): YearMedianRow[] {
  const yearly = new Map<number, Record<Leg, number[]>>();

  for (const row of rows) {
    const year = Number(row.year);
    if (!Number.isFinite(year)) {
      continue;
    }

    const swimSeconds = timeToSeconds(row.swim_time ?? null);
    const bikeSeconds = timeToSeconds(row.bike_time ?? null);
    const runStartSeconds = timeToSeconds(row.run_start_time ?? null);
    const run325Seconds = timeToSeconds(row.run_32_5km_langefonn_time ?? null);
    const runSegmentSeconds =
      runStartSeconds !== null && run325Seconds !== null ? run325Seconds - runStartSeconds : null;

    if (!yearly.has(year)) {
      yearly.set(year, {
        Swim: [],
        Bike: [],
        "Run (to 32.5 km)": [],
      });
    }

    const bucket = yearly.get(year)!;

    if (swimSeconds !== null) {
      bucket.Swim.push(swimSeconds);
    }

    if (bikeSeconds !== null) {
      bucket.Bike.push(bikeSeconds);
    }

    if (runSegmentSeconds !== null && runSegmentSeconds > 0) {
      bucket["Run (to 32.5 km)"].push(runSegmentSeconds);
    }
  }

  const medians: YearMedianRow[] = [];

  for (const [year, legs] of yearly.entries()) {
    for (const leg of LEG_ORDER) {
      const medianSeconds = median(legs[leg]);
      if (medianSeconds !== null) {
        medians.push({ year, leg, medianSeconds });
      }
    }
  }

  return medians.sort((left, right) => right.year - left.year);
}

function buildYearCompareFigure(
  medians: YearMedianRow[],
  mode: YearComparisonMode,
): ComparisonFigure {
  const baseline = new Map<Leg, number>();
  for (const row of medians) {
    if (row.year === BASELINE_YEAR) {
      baseline.set(row.leg, row.medianSeconds);
    }
  }

  const years = [...new Set(medians.map((row) => row.year))].sort((left, right) => right - left);
  const data: Data[] = LEG_ORDER.map((leg) => {
    const rows = medians.filter((row) => row.leg === leg);
    const x = rows.map((row) => row.medianSeconds / 3600);
    const y = rows.map((row) => row.year);

    const text =
      mode === "Time Overview"
        ? rows.map((row) => secondsToPaddedHms(row.medianSeconds))
        : rows.map((row) => {
            const baselineSeconds = baseline.get(leg);
            if (baselineSeconds === undefined) {
              return "—";
            }

            const deltaMinutes = (row.medianSeconds - baselineSeconds) / 60;
            const sign = deltaMinutes > 0 ? "+" : "";
            return `${secondsToPaddedHms(row.medianSeconds)} (${sign}${deltaMinutes.toFixed(1)} min)`;
          });

    const markerColor =
      mode === "Time Overview"
        ? SEGMENT_COLORS[leg]
        : rows.map((row) => {
            const baselineSeconds = baseline.get(leg);
            if (baselineSeconds === undefined || row.year === BASELINE_YEAR) {
              return "#bdbdbd";
            }
            if (row.medianSeconds < baselineSeconds) {
              return "#2e7d32";
            }
            if (row.medianSeconds > baselineSeconds) {
              return "#c62828";
            }
            return "#bdbdbd";
          });

    return {
      type: "bar",
      name: leg,
      x,
      y,
      orientation: "h",
      marker: { color: markerColor },
      text,
      textposition: "inside",
      insidetextanchor: "middle",
      hovertemplate:
        "<b>Year</b>: %{y}<br><b>Leg</b>: " + leg + "<br><b>Median</b>: %{text}<extra></extra>",
    };
  });

  const layout: Partial<Layout> = {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "#eef5fb", family: "IBM Plex Sans, sans-serif" },
    barmode: "group",
    bargap: 0.28,
    bargroupgap: 0.1,
    height: 520,
    margin: { l: 48, r: 24, t: 32, b: 52 },
    xaxis: {
      title: { text: "Median time (hours)" },
      showgrid: true,
      zeroline: false,
      tickformat: ".1f",
      gridcolor: "rgba(167, 194, 218, 0.16)",
    },
    yaxis: {
      title: { text: "Year" },
      type: "category",
      categoryorder: "array",
      categoryarray: years,
      autorange: "reversed",
    },
    legend: {
      title: { text: " " },
      orientation: "h",
      yanchor: "bottom",
      y: 1.02,
      xanchor: "left",
      x: 0,
    },
  };

  return {
    data,
    layout,
    previewLayout: {
      ...layout,
      font: {
        color: "#eef5fb",
        family: "IBM Plex Sans, sans-serif",
        size: 10,
      },
      margin: { l: 40, r: 12, t: 18, b: 38 },
      xaxis: {
        ...layout.xaxis,
        title: { text: "Median time (hours)", font: { size: 11 } },
        tickfont: { size: 10 },
      },
      yaxis: {
        ...layout.yaxis,
        title: { text: "Year", font: { size: 11 } },
        tickfont: { size: 10 },
      },
      legend: {
        ...layout.legend,
        font: { size: 10 },
        itemwidth: 40,
        y: 1,
      },
    },
  };
}

function zoomedHourRange(values: number[]) {
  if (values.length === 0) {
    return undefined;
  }

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const spread = maxValue - minValue;
  const padding = Math.max(spread * 0.35, 0.08);

  return [Math.max(0, minValue - padding), maxValue + padding];
}

function buildTrendFigure(
  rows: WideRow[],
  zoomOverallDifferences: boolean,
): ComparisonFigure | null {
  const finishSecondsByYear = new Map<number, number[]>();

  for (const row of rows) {
    const year = Number(row.year);
    if (!Number.isFinite(year)) {
      continue;
    }

    const finishSeconds =
      timeToSeconds(row.overall_time ?? null) ??
      (() => {
        const swim = timeToSeconds(row.swim_time ?? null);
        const bike = timeToSeconds(row.bike_time ?? null);
        const run = timeToSeconds(row.run_time ?? null);
        if (swim === null || bike === null || run === null) {
          return null;
        }
        return swim + bike + run;
      })();

    if (finishSeconds === null) {
      continue;
    }

    if (!finishSecondsByYear.has(year)) {
      finishSecondsByYear.set(year, []);
    }

    finishSecondsByYear.get(year)!.push(finishSeconds);
  }

  const yearly = [...finishSecondsByYear.entries()]
    .map(([year, values]) => {
      const medianSeconds = median(values);
      if (medianSeconds === null) {
        return null;
      }
      return {
        year,
        medianSeconds,
        medianHours: medianSeconds / 3600,
        label: secondsToPaddedHms(medianSeconds),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((left, right) => left.year - right.year);

  if (yearly.length === 0) {
    return null;
  }

  const medianHours = yearly.map((entry) => entry.medianHours);
  const yAxisRange = zoomOverallDifferences ? zoomedHourRange(medianHours) : undefined;

  const layout: Partial<Layout> = {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "#eef5fb", family: "IBM Plex Sans, sans-serif" },
    height: 420,
    margin: { l: 48, r: 24, t: 28, b: 48 },
    xaxis: {
      title: { text: "Year" },
      type: "category",
      categoryorder: "array",
      categoryarray: yearly.map((entry) => entry.year),
      showgrid: false,
      zeroline: false,
    },
    yaxis: {
      title: { text: "Median finish time (hours)" },
      showgrid: true,
      zeroline: false,
      tickformat: ".1f",
      gridcolor: "rgba(167, 194, 218, 0.16)",
      range: yAxisRange,
    },
    showlegend: false,
  };

  return {
    data: [
      {
        type: "bar",
        x: yearly.map((entry) => entry.year),
        y: yearly.map((entry) => entry.medianHours),
        width: 0.2,
        marker: { color: "#4A4A4A" },
        text: yearly.map((entry) => entry.label),
        textposition: "outside",
        hovertemplate: "<b>Year</b>: %{x}<br><b>Median finish</b>: %{text}<extra></extra>",
      },
      {
        type: "scatter",
        mode: "lines+markers",
        x: yearly.map((entry) => entry.year),
        y: yearly.map((entry) => entry.medianHours),
        marker: { color: "orange" },
        line: { color: "orange", width: 3 },
        text: yearly.map((entry) => entry.label),
        hovertemplate: "<b>Year</b>: %{x}<br><b>Median finish</b>: %{text}<extra></extra>",
      },
    ],
    layout,
    previewLayout: {
      ...layout,
      font: {
        color: "#eef5fb",
        family: "IBM Plex Sans, sans-serif",
        size: 10,
      },
      margin: { l: 40, r: 12, t: 16, b: 36 },
      xaxis: {
        ...layout.xaxis,
        title: { text: "Year", font: { size: 11 } },
        tickfont: { size: 10 },
      },
      yaxis: {
        ...layout.yaxis,
        title: { text: "Median finish time (hours)", font: { size: 11 } },
        tickfont: { size: 10 },
      },
    },
  };
}

function buildTableRows(medians: YearMedianRow[]): ComparisonTableRow[] {
  const years = [...new Set(medians.map((row) => row.year))].sort((left, right) => right - left);

  return years.map((year) => {
    const byLeg = new Map<Leg, number>();
    for (const row of medians) {
      if (row.year === year) {
        byLeg.set(row.leg, row.medianSeconds);
      }
    }

    return {
      year,
      swim: secondsToHms(byLeg.get("Swim") ?? null) || "—",
      bike: secondsToHms(byLeg.get("Bike") ?? null) || "—",
      runTo325Km: secondsToHms(byLeg.get("Run (to 32.5 km)") ?? null) || "—",
    };
  });
}

export function buildYearComparisonModel(
  rows: WideRow[],
  selectedGroup: GroupOption,
  mode: YearComparisonMode,
  zoomOverallDifferences = false,
): YearComparisonModel {
  const filteredRows = filterRowsByGroup(rows, selectedGroup);
  if (filteredRows.length === 0) {
    return {
      comparisonFigure: null,
      overallFigure: null,
      tableRows: [],
      warning: "No data is available for the selected group.",
      comparisonWarning: "No data is available for the selected group.",
      overallWarning: "No data is available for the selected group.",
    };
  }

  const medians = toLegMedianRows(filteredRows);
  const comparisonFigure = medians.length > 0 ? buildYearCompareFigure(medians, mode) : null;
  const overallFigure = buildTrendFigure(filteredRows, zoomOverallDifferences);
  const comparisonWarning =
    comparisonFigure === null
      ? "No split medians are available because the selected rows do not contain the required segment times."
      : null;
  const overallWarning =
    overallFigure === null
      ? "Overall median view needs finish times, but none were available for the current selection."
      : null;
  const warning =
    comparisonFigure === null && overallFigure === null
      ? comparisonWarning ?? overallWarning ?? "No yearly medians are available for the current selection."
      : null;

  return {
    comparisonFigure,
    overallFigure,
    tableRows: medians.length > 0 ? buildTableRows(medians) : [],
    warning,
    comparisonWarning,
    overallWarning,
  };
}
