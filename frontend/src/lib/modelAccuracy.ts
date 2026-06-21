import type { Data, Layout } from "plotly.js";

import type { GroupOption } from "@/config/raceRegistry";
import type { CourseProfileRow, ModelRow } from "@/types/data";

type PlotFigure = {
  data: Data[];
  layout: Partial<Layout>;
};

type AccuracyRow = {
  splitKey: string;
  raceDistanceKm: number;
  accuracyPct: number;
  nObs: number;
};

export type ModelAccuracyModel = {
  figure: PlotFigure | null;
  warning: string | null;
};

const COURSE_BG = "#7a7a7a";

function isFiniteNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function applyFilters(rows: ModelRow[], year: number | "All", group: GroupOption) {
  return rows
    .filter((row) => row.set === undefined || row.set === "test")
    .filter((row) => year === "All" || row.year === year)
    .filter((row) => {
      if (group === "All") {
        return true;
      }
      if (group === "Top 10") {
        return isFiniteNumber(row.split_rank) && row.split_rank <= 10;
      }
      if (group === "Black Shirt") {
        return row.finish_type.toLowerCase().includes("black");
      }
      if (group === "White Shirt") {
        return row.finish_type.toLowerCase().includes("white");
      }
      if (group === "DNF") {
        return row.finish_type.toLowerCase().includes("dnf");
      }
      return true;
    });
}

function computeAccuracyByStation(rows: ModelRow[]): AccuracyRow[] {
  const grouped = new Map<string, { splitKey: string; raceDistanceKm: number; correct: number; total: number }>();

  for (const row of rows) {
    if (
      !isFiniteNumber(row.race_distance_km) ||
      !isFiniteNumber(row.y_true) ||
      !isFiniteNumber(row.y_pred)
    ) {
      continue;
    }

    const key = `${row.split_key}:${row.race_distance_km}`;
    const bucket = grouped.get(key) ?? {
      splitKey: row.split_key,
      raceDistanceKm: row.race_distance_km,
      correct: 0,
      total: 0,
    };

    bucket.correct += row.y_true === row.y_pred ? 1 : 0;
    bucket.total += 1;
    grouped.set(key, bucket);
  }

  return [...grouped.values()]
    .filter((row) => row.total > 0)
    .sort((left, right) => left.raceDistanceKm - right.raceDistanceKm)
    .map((row) => ({
      splitKey: row.splitKey,
      raceDistanceKm: row.raceDistanceKm,
      accuracyPct: (row.correct / row.total) * 100,
      nObs: row.total,
    }));
}

function makeSparseTickLabels(rows: AccuracyRow[], minSpacingKm = 6) {
  const tickvals = rows.map((row) => row.raceDistanceKm);
  const ticktext = new Array<string>(tickvals.length).fill("");
  let lastLabeled: number | null = null;

  for (let index = 0; index < rows.length; index += 1) {
    const distance = rows[index].raceDistanceKm;
    if (lastLabeled === null || distance - lastLabeled >= minSpacingKm) {
      ticktext[index] = rows[index].splitKey;
      lastLabeled = distance;
    }
  }

  if (ticktext.length > 0) {
    ticktext[ticktext.length - 1] = rows[rows.length - 1].splitKey;
  }

  return {
    tickvals,
    ticktext,
  };
}

function colorForSlopePct(slopePct: number) {
  if (slopePct <= -4) return "rgba(0, 200, 255, 0.60)";
  if (slopePct <= -1) return "rgba(0, 160, 255, 0.50)";
  if (slopePct < 1) return "rgba(255, 255, 255, 0.14)";
  if (slopePct < 4) return "rgba(255, 80, 200, 0.55)";
  return "rgba(180, 0, 255, 0.60)";
}

function buildGradientElevationTraces(courseRows: CourseProfileRow[]) {
  const rows = courseRows
    .filter(
      (row) =>
        isFiniteNumber(row.distance_km) &&
        isFiniteNumber(row.elev_norseman_m),
    )
    .slice()
    .sort((left, right) => left.distance_km - right.distance_km);

  if (rows.length < 2) {
    return [] as Data[];
  }

  const sampled = new Map<number, { distance_km: number; elev_norseman_m: number }>();
  for (const row of rows) {
    const bucket = Math.round(row.distance_km / 0.5);
    const existing = sampled.get(bucket);
    if (!existing) {
      sampled.set(bucket, {
        distance_km: row.distance_km,
        elev_norseman_m: row.elev_norseman_m!,
      });
    } else {
      sampled.set(bucket, {
        distance_km: (existing.distance_km + row.distance_km) / 2,
        elev_norseman_m: (existing.elev_norseman_m + row.elev_norseman_m!) / 2,
      });
    }
  }

  const simplified = [...sampled.values()].sort((left, right) => left.distance_km - right.distance_km);
  if (simplified.length < 2) {
    return [] as Data[];
  }

  const traces: Data[] = [];
  let blockStart = 0;
  let activeColor: string | null = null;

  function flushBlock(endIndex: number, color: string) {
    traces.push({
      type: "scatter",
      x: simplified.slice(blockStart, endIndex + 1).map((row) => row.distance_km),
      y: simplified.slice(blockStart, endIndex + 1).map((row) => row.elev_norseman_m),
      mode: "lines",
      line: {
        width: 0,
      },
      fill: "tozeroy",
      fillcolor: color,
      showlegend: false,
      hoverinfo: "skip",
      yaxis: "y2",
    } as Data);
  }

  for (let index = 0; index < simplified.length - 1; index += 1) {
    const current = simplified[index];
    const next = simplified[index + 1];
    const dxMeters = (next.distance_km - current.distance_km) * 1000;
    const dyMeters = next.elev_norseman_m - current.elev_norseman_m;
    const slopePct = dxMeters === 0 ? 0 : (dyMeters / dxMeters) * 100;
    const color = colorForSlopePct(slopePct);

    if (activeColor === null) {
      activeColor = color;
      blockStart = index;
      continue;
    }

    if (color !== activeColor) {
      flushBlock(index, activeColor);
      blockStart = index;
      activeColor = color;
    }
  }

  if (activeColor !== null) {
    flushBlock(simplified.length - 1, activeColor);
  }

  traces.push({
    type: "scatter",
    x: rows.map((row) => row.distance_km),
    y: rows.map((row) => row.elev_norseman_m ?? null),
    name: "Norseman elevation",
    mode: "lines",
    line: {
      width: 1.5,
      color: "#4C5FD7",
    },
    hovertemplate: "km %{x:.1f}<br>Elev: %{y:.0f} m<extra></extra>",
    yaxis: "y2",
  } as Data);

  return traces;
}

export function buildModelAccuracyModel(
  modelRows: ModelRow[],
  courseRows: CourseProfileRow[],
  selectedYear: number | "All",
  selectedGroup: GroupOption,
): ModelAccuracyModel {
  const filteredRows = applyFilters(modelRows, selectedYear, selectedGroup);
  const accuracyRows = computeAccuracyByStation(filteredRows);

  if (accuracyRows.length === 0) {
    return {
      figure: null,
      warning: "No model-evaluation data is available for the current year/group filter selection.",
    };
  }

  const tickConfig = makeSparseTickLabels(accuracyRows);
  const courseTraces = buildGradientElevationTraces(courseRows);
  const accuracyMin = Math.max(
    0,
    Math.min(...accuracyRows.map((row) => row.accuracyPct)) - 3,
  );
  const accuracyMax = Math.min(
    100,
    Math.max(...accuracyRows.map((row) => row.accuracyPct)) + 3,
  );
  const xMax = Math.max(
    accuracyRows[accuracyRows.length - 1].raceDistanceKm,
    ...courseRows.map((row) => row.distance_km),
  );

  const figure: PlotFigure = {
    data: [
      ...courseTraces,
      {
        type: "scatter",
        x: accuracyRows.map((row) => row.raceDistanceKm),
        y: accuracyRows.map((row) => row.accuracyPct),
        mode: "lines+markers",
        line: {
          width: 4,
          color: "#FFB000",
        },
        marker: {
          size: 8,
          color: "#FFB000",
        },
        name: "Model accuracy",
        customdata: accuracyRows.map((row) => [row.splitKey, row.nObs]),
        hovertemplate:
          "Station: %{customdata[0]}<br>" +
          "Distance: %{x:.1f} km<br>" +
          "Accuracy: %{y:.2f}%<br>" +
          "n = %{customdata[1]}<extra></extra>",
      } as Data,
    ],
    layout: {
      height: 740,
      paper_bgcolor: COURSE_BG,
      plot_bgcolor: COURSE_BG,
      margin: {
        l: 80,
        r: 110,
        t: 30,
        b: 90,
      },
      hovermode: "x unified",
      legend: {
        bgcolor: COURSE_BG,
        font: {
          color: "#ffffff",
          size: 18,
        },
        yanchor: "top",
        y: 1,
        xanchor: "left",
        x: 1.02,
        traceorder: "reversed",
      },
      xaxis: {
        title: {
          text: "Distance (km)",
        },
        range: [0, xMax],
        tickmode: "array",
        tickvals: tickConfig.tickvals,
        ticktext: tickConfig.ticktext,
        tickangle: -60,
        ticklabelposition: "outside",
        automargin: true,
        showgrid: false,
        zeroline: false,
      },
      yaxis: {
        title: {
          text: "Model accuracy (%)",
        },
        range: [accuracyMin, accuracyMax],
        tickformat: ".0f",
        showgrid: true,
        gridcolor: "rgba(255,255,255,0.2)",
        zeroline: false,
      },
      yaxis2: {
        title: {
          text: "Elevation (m)",
        },
        overlaying: "y",
        side: "right",
        rangemode: "tozero",
        showgrid: false,
        zeroline: false,
      },
      shapes: accuracyRows.map((row) => ({
        type: "line",
        xref: "x",
        yref: "paper",
        x0: row.raceDistanceKm,
        x1: row.raceDistanceKm,
        y0: 0,
        y1: 1,
        line: {
          color: "rgba(255,255,255,0.25)",
          dash: "dash",
          width: 1,
        },
        layer: "below",
      })),
    },
  };

  return {
    figure,
    warning:
      selectedGroup === "Top 10"
        ? "The original Streamlit behavior is preserved here: the Top 10 filter is evaluated via split rank at each timing station, not only by final overall rank."
        : null,
  };
}
