import type { Data, Layout } from "plotly.js";

import type { GroupOption } from "@/config/raceRegistry";
import { classifyFinishGroup, filterRowsByYear } from "@/lib/groups";
import type { LongRow } from "@/types/data";

type PlotFigure = {
  data: Data[];
  layout: Partial<Layout>;
};

export type AccumulatedModel = {
  figure: PlotFigure | null;
  warning: string | null;
};

type AccumulatedRow = {
  athleteId: string;
  year: number;
  bib: number;
  category: "Top10" | "Black" | "White" | "DNF" | "Other";
  cumDistanceKm: number;
  cumTimeHours: number;
  xPlot: number;
};

const SWIM_KM = 3.8;
const BIKE_KM = 180.0;
const RUN_KM = 42.2;
const GAP_KM = 6.0;
const GRID_COLOR = "#C8C8C8";

function toAccumulatedCategory(row: LongRow): AccumulatedRow["category"] {
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

function normalizeAccumulatedRows(rows: LongRow[]): AccumulatedRow[] {
  const bikeOffset = SWIM_KM + GAP_KM;
  const runOffset = SWIM_KM + GAP_KM + BIKE_KM + GAP_KM;
  const bikeEnd = SWIM_KM + BIKE_KM;

  const scoped = rows
    .filter(
      (row) =>
        Number.isFinite(Number(row.year)) &&
        Number.isFinite(Number(row.bib)) &&
        Number.isFinite(Number(row.race_distance_km ?? Number.NaN)) &&
        Number.isFinite(Number(row.cum_time_seconds ?? Number.NaN)),
    )
    .map((row) => {
      const year = Number(row.year);
      const bib = Number(row.bib);
      const cumDistanceKm = Number(row.race_distance_km);
      const leg =
        cumDistanceKm <= SWIM_KM + 1e-9
          ? "swim"
          : cumDistanceKm <= bikeEnd + 1e-9
            ? "bike"
            : "run";
      const legKm =
        leg === "swim" ? cumDistanceKm : leg === "bike" ? cumDistanceKm - SWIM_KM : cumDistanceKm - bikeEnd;
      const xPlot =
        leg === "swim" ? legKm : leg === "bike" ? legKm + bikeOffset : legKm + runOffset;

      return {
        athleteId: `${year}_${bib}`,
        year,
        bib,
        category: toAccumulatedCategory(row),
        cumDistanceKm: Math.max(0, Math.min(cumDistanceKm, 226)),
        cumTimeHours: Number(row.cum_time_seconds) / 3600,
        xPlot,
      };
    })
    .sort((left, right) => {
      if (left.athleteId !== right.athleteId) {
        return left.athleteId.localeCompare(right.athleteId);
      }
      return left.cumDistanceKm - right.cumDistanceKm;
    });

  const result: AccumulatedRow[] = [];
  let currentAthlete = "";
  let currentMax = Number.NEGATIVE_INFINITY;

  for (const row of scoped) {
    if (row.athleteId !== currentAthlete) {
      currentAthlete = row.athleteId;
      currentMax = Number.NEGATIVE_INFINITY;
    }
    currentMax = Math.max(currentMax, row.cumTimeHours);
    result.push({ ...row, cumTimeHours: currentMax });
  }

  return result;
}

function applyFilters(
  rows: AccumulatedRow[],
  selectedYear: number | "All",
  selectedGroup: GroupOption,
): AccumulatedRow[] {
  let filtered = filterRowsByYear(rows, selectedYear);

  if (selectedGroup === "Top 10") {
    filtered = filtered.filter((row) => row.category === "Top10");
  } else if (selectedGroup === "Black Shirt") {
    filtered = filtered.filter((row) => row.category === "Black" || row.category === "Top10");
  } else if (selectedGroup === "White Shirt") {
    filtered = filtered.filter((row) => row.category === "White");
  } else if (selectedGroup === "DNF") {
    filtered = filtered.filter((row) => row.category === "DNF");
  }

  return filtered;
}

function buildFigure(rows: AccumulatedRow[]): PlotFigure {
  const bikeOffset = SWIM_KM + GAP_KM;
  const runOffset = SWIM_KM + GAP_KM + BIKE_KM + GAP_KM;
  const xMax = runOffset + RUN_KM;

  const grouped = new Map<string, AccumulatedRow[]>();
  for (const row of rows) {
    const bucket = grouped.get(row.athleteId) ?? [];
    bucket.push(row);
    grouped.set(row.athleteId, bucket);
  }

  const categoryOrder: Array<AccumulatedRow["category"]> = ["DNF", "White", "Black", "Top10", "Other"];
  const categoryColor: Record<AccumulatedRow["category"], string> = {
    DNF: "#FF4B4B",
    White: "#FFFFFF",
    Black: "#000000",
    Top10: "#2ECC71",
    Other: "#9b9b9b",
  };

  const data: Data[] = [];
  const categoryLegendSeen = new Set<AccumulatedRow["category"]>();

  const athleteEntries = [...grouped.entries()].sort((left, right) => {
    const leftCategory = left[1][0]?.category ?? "Other";
    const rightCategory = right[1][0]?.category ?? "Other";
    const leftRank = categoryOrder.indexOf(leftCategory);
    const rightRank = categoryOrder.indexOf(rightCategory);
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return left[0].localeCompare(right[0]);
  });

  for (const [, athleteRows] of athleteEntries) {
    const category = athleteRows[0]?.category ?? "Other";
    const baseOpacity =
      category === "Top10" ? 1.0 : category === "DNF" ? 0.75 : category === "Black" ? 0.7 : category === "White" ? 0.65 : 0.6;

    data.push({
      type: "scatter",
      x: athleteRows.map((row) => row.xPlot),
      y: athleteRows.map((row) => row.cumTimeHours),
      mode: "lines",
      line: {
        color: categoryColor[category],
        width: category === "Top10" ? 1.8 : category === "DNF" ? 1.6 : 1.0,
      },
      opacity: categoryLegendSeen.has(category) ? baseOpacity : 1.0,
      name: category,
      legendgroup: category,
      showlegend: !categoryLegendSeen.has(category),
      hoverinfo: "none",
    });
    categoryLegendSeen.add(category);
  }

  const splitPositions = [...new Set(rows.map((row) => Number(row.xPlot.toFixed(1))))].sort((left, right) => left - right);
  const shapes: NonNullable<Layout["shapes"]> = splitPositions.map((position) => ({
    type: "line",
    xref: "x",
    yref: "paper",
    x0: position,
    x1: position,
    y0: 0,
    y1: 1,
    line: { color: GRID_COLOR, width: 1, dash: "dot" },
    layer: "below",
  }));

  for (const position of [SWIM_KM, bikeOffset + BIKE_KM]) {
    shapes.push({
      type: "line",
      xref: "x",
      yref: "paper",
      x0: position,
      x1: position,
      y0: 0,
      y1: 1,
      line: { color: "white", width: 2 },
      layer: "above",
    });
  }

  shapes.push({
    type: "line",
    xref: "paper",
    yref: "paper",
    x0: 0,
    x1: 1,
    y0: 0,
    y1: 0,
    line: { color: "white", width: 2 },
    layer: "above",
  });

  return {
    data,
    layout: {
      plot_bgcolor: "#7A7A7A",
      paper_bgcolor: "#7A7A7A",
      font: { color: "white", family: "IBM Plex Sans, sans-serif" },
      legend: {
        bgcolor: "#7A7A7A",
        font: { color: "white", size: 30 },
        itemsizing: "constant",
        itemwidth: 40,
      },
      margin: { l: 40, r: 20, t: 20, b: 40 },
      hovermode: "closest",
      shapes,
      xaxis: {
        title: { text: "Distance (km)", font: { color: "white", size: 25 } },
        range: [0, xMax],
        showgrid: true,
        gridcolor: GRID_COLOR,
        griddash: "dot",
        zeroline: false,
        tickmode: "array",
        tickvals: [0, SWIM_KM, bikeOffset + BIKE_KM, runOffset + RUN_KM],
        ticktext: ["0", `${SWIM_KM}`, `${BIKE_KM}`, `${RUN_KM}`],
        tickfont: { color: "white", size: 14 },
      },
      yaxis: {
        title: { text: "Time (hours)", font: { color: "white", size: 25 } },
        showgrid: true,
        gridcolor: GRID_COLOR,
        griddash: "dot",
        zeroline: false,
        tickfont: { color: "white", size: 14 },
      },
      annotations: [
        {
          x: SWIM_KM / 2,
          y: 1.06,
          xref: "x",
          yref: "paper",
          text: "Swim",
          showarrow: false,
          font: { color: "white", size: 16 },
        },
        {
          x: bikeOffset + BIKE_KM / 2,
          y: 1.06,
          xref: "x",
          yref: "paper",
          text: "Bike",
          showarrow: false,
          font: { color: "white", size: 16 },
        },
        {
          x: runOffset + RUN_KM / 2,
          y: 1.06,
          xref: "x",
          yref: "paper",
          text: "Run",
          showarrow: false,
          font: { color: "white", size: 16 },
        },
      ],
    },
  };
}

export function buildAccumulatedModel(
  rows: LongRow[],
  selectedYear: number | "All",
  selectedGroup: GroupOption,
): AccumulatedModel {
  if (rows.length === 0) {
    return {
      figure: null,
      warning: "No data available.",
    };
  }

  const normalized = normalizeAccumulatedRows(rows);
  const filtered = applyFilters(normalized, selectedYear, selectedGroup);

  if (filtered.length === 0) {
    return {
      figure: null,
      warning: "No data for the selected filters.",
    };
  }

  return {
    figure: buildFigure(filtered),
    warning: null,
  };
}
