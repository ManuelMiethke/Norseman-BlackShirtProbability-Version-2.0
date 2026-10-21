import type { Data, Layout } from "plotly.js";

import { CUTOFF_37_5_YEARS, RACE_YEAR_REGISTRY } from "@/config/raceRegistry";
import type { LongRow } from "@/types/data";

import { PALETTE } from "@/lib/theme";
// Jahre und Cut-off-Splits kommen aus der Registry, damit ein neues
// Renn-Jahr nicht an mehreren Stellen nachgetragen werden muss
const YEARS_TO_PLOT = Object.values(RACE_YEAR_REGISTRY)
  .map((config) => config.year)
  .sort((left, right) => left - right);
const CUTOFF_SECONDS = 14 * 3600 + 45 * 60;
const CUTOFF_SPLIT_BY_YEAR: Record<number, string> = Object.values(
  RACE_YEAR_REGISTRY,
).reduce<Record<number, string>>((acc, config) => {
  acc[config.year] = config.cutoffSplitKey;
  return acc;
}, {});
const DNF_HARDCODED: Record<number, number> = {
  2018: 7,
  2019: 12,
  2021: 11,
  2022: 16,
  2024: 17,
  2025: 11,
  2026: 15,
};

type PlotFigure = {
  data: Data[];
  layout: Partial<Layout>;
};

type OutcomeRow = {
  year: number;
  black: number;
  whiteCompetition: number;
  whiteOther: number;
  dnf: number;
};

export type WhoAreWeRacingModel = {
  outcomesFigure: PlotFigure | null;
  frontierFigure: PlotFigure | null;
  frontierMedianHours: number | null;
  warning: string | null;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isFinishSplit(splitKey: string, group: "black" | "white") {
  const key = splitKey.toLowerCase();
  return key.includes("finish") && key.includes(group);
}

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

function buildOutcomes(rows: LongRow[]): OutcomeRow[] {
  const scopedRows = rows.filter((row) => YEARS_TO_PLOT.includes(Number(row.year)));

  return YEARS_TO_PLOT.map((year) => {
    const yearRows = scopedRows.filter((row) => Number(row.year) === year);
    const cutoffKey = CUTOFF_SPLIT_BY_YEAR[year];

    const cutoffRows = yearRows.filter(
      (row) =>
        row.split_key === cutoffKey &&
        isFiniteNumber(row.cum_time_seconds) &&
        isFiniteNumber(row.split_rank),
    );
    const blackFinishers = new Set(
      yearRows.filter((row) => isFinishSplit(row.split_key, "black")).map((row) => row.bib),
    );
    const whiteFinishers = new Set(
      yearRows.filter((row) => isFinishSplit(row.split_key, "white")).map((row) => row.bib),
    );

    const whiteCompetition = new Set(
      cutoffRows
        .filter((row) => row.cum_time_seconds! <= CUTOFF_SECONDS && row.split_rank! > 160)
        .map((row) => row.bib),
    ).size;

    const whiteOther = Math.max(whiteFinishers.size - whiteCompetition, 0);

    return {
      year,
      black: blackFinishers.size,
      whiteCompetition,
      whiteOther,
      dnf: DNF_HARDCODED[year] ?? 0,
    };
  });
}

function buildOutcomesFigure(outcomes: OutcomeRow[]): PlotFigure {
  const yearLabels = outcomes.map((row) => String(row.year));

  return {
    data: [
      {
        type: "bar",
        x: yearLabels,
        y: outcomes.map((row) => row.dnf),
        name: "DNF",
        marker: { color: PALETTE.dnf },
      },
      {
        type: "bar",
        x: yearLabels,
        y: outcomes.map((row) => row.whiteOther),
        name: "White Finishers (no cut-off)",
        marker: {
          color: "white",
          line: { color: "black", width: 1 },
        },
      },
      {
        type: "bar",
        x: yearLabels,
        y: outcomes.map((row) => row.whiteCompetition),
        name: "Missed (due to competition)",
        marker: {
          color: "white",
          line: { color: "black", width: 1 },
          pattern: { shape: "/", fgcolor: "black", bgcolor: "white", solidity: 0.35 },
        },
      },
      {
        type: "bar",
        x: yearLabels,
        y: outcomes.map((row) => row.black),
        name: "Black Shirts",
        marker: { color: "black" },
      },
    ],
    layout: {
      barmode: "stack",
      bargap: 0.35,
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: "#eef5fb", family: "IBM Plex Sans, sans-serif", size: 14 },
      height: 520,
      showlegend: false,
      margin: { l: 44, r: 12, t: 8, b: 28 },
      xaxis: {
        type: "category",
        categoryorder: "array",
        categoryarray: yearLabels,
        showgrid: true,
        gridcolor: "rgba(167, 194, 218, 0.16)",
      },
      yaxis: {
        title: { text: "Athletes" },
        showgrid: true,
        gridcolor: "rgba(167, 194, 218, 0.16)",
      },
    },
  };
}

function buildFrontierFigure(rows: LongRow[]): {
  figure: PlotFigure | null;
  medianHours: number | null;
} {
  const frontierYears = [...CUTOFF_37_5_YEARS].sort((left, right) => left - right);
  const frontierRows = rows.filter(
    (row) =>
      frontierYears.includes(Number(row.year)) &&
      row.split_key === CUTOFF_SPLIT_BY_YEAR[Number(row.year)] &&
      isFiniteNumber(row.cum_time_seconds) &&
      isFiniteNumber(row.split_rank),
  );

  const yearly = frontierYears
    .map((year) => {
      const yearRows = frontierRows
        .filter((row) => Number(row.year) === year)
        .sort((left, right) => Math.abs((left.split_rank ?? 9999) - 160) - Math.abs((right.split_rank ?? 9999) - 160));

      if (yearRows.length === 0) {
        return null;
      }

      const exact = yearRows.find((row) => row.split_rank === 160);
      const frontierSeconds = exact?.cum_time_seconds ?? yearRows[0].cum_time_seconds ?? null;
      if (!isFiniteNumber(frontierSeconds)) {
        return null;
      }

      return {
        year,
        hours: frontierSeconds / 3600,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  if (yearly.length === 0) {
    return { figure: null, medianHours: null };
  }

  const medianHours = median(yearly.map((entry) => entry.hours));
  if (medianHours === null) {
    return { figure: null, medianHours: null };
  }
  const labels = yearly.map((entry) => String(entry.year)).sort((left, right) => Number(right) - Number(left));
  const sorted = [...yearly].sort((left, right) => right.year - left.year);

  return {
    medianHours,
    figure: {
      data: [
        {
          type: "bar",
          y: sorted.map((entry) => String(entry.year)),
          x: sorted.map((entry) => entry.hours),
          orientation: "h",
          marker: { color: PALETTE.black },
          name: "Rank ~160 time",
          hovertemplate: "<b>Year</b>: %{y}<br><b>Hours at cut-off</b>: %{x:.2f}<extra></extra>",
        },
      ],
      layout: {
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        font: { color: "#eef5fb", family: "IBM Plex Sans, sans-serif", size: 14 },
        height: 360,
        margin: { l: 44, r: 12, t: 8, b: 28 },
        bargap: 0.45,
        xaxis: {
          title: { text: "Hours at cut-off" },
          showgrid: true,
          gridcolor: "rgba(167, 194, 218, 0.16)",
        },
        yaxis: {
          type: "category",
          categoryorder: "array",
          categoryarray: labels,
          showgrid: false,
        },
        showlegend: false,
        shapes: [
          {
            type: "line",
            x0: medianHours,
            x1: medianHours,
            y0: 0,
            y1: 1,
            xref: "x",
            yref: "paper",
            line: {
              color: PALETTE.accent,
              width: 2.5,
              dash: "dash",
            },
          },
        ],
      },
    },
  };
}

export function buildWhoAreWeRacingModel(rows: LongRow[]): WhoAreWeRacingModel {
  const relevantRows = rows.filter((row) => YEARS_TO_PLOT.includes(Number(row.year)));
  if (relevantRows.length === 0) {
    return {
      outcomesFigure: null,
      frontierFigure: null,
      frontierMedianHours: null,
      warning: "No split data is available for the supported Norseman race years.",
    };
  }

  const outcomes = buildOutcomes(relevantRows);
  const outcomesFigure = buildOutcomesFigure(outcomes);
  const { figure: frontierFigure, medianHours: frontierMedianHours } = buildFrontierFigure(relevantRows);

  if (!frontierFigure || frontierMedianHours === null) {
    return {
      outcomesFigure,
      frontierFigure: null,
      frontierMedianHours: null,
      warning: "The stacked outcome chart is available, but the 37.5 km frontier view could not be calculated from the packaged split data.",
    };
  }

  return {
    outcomesFigure,
    frontierFigure,
    frontierMedianHours,
    warning: null,
  };
}
