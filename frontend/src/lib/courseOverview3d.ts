import type { Data, Layout } from "plotly.js";

import { PALETTE } from "@/lib/theme";

/**
 * 3D course model for the Norseman: the swim, bike and run GPX tracks are
 * stitched into one route, drawn as a "terrain wall" (route line on top,
 * vertical curtain down to sea level) and shaded by gradient. Every relevant
 * climb is labelled directly at its summit with length, average gradient and
 * elevation gain, so the course map and the elevation profile are one view.
 */

export type CourseLeg = "Swim" | "Bike" | "Run";

type RawPoint = { lat: number; lon: number; ele: number; leg: CourseLeg };

type Sample = {
  distanceM: number;
  x: number;
  y: number;
  ele: number;
  smoothEle: number;
  gradePct: number;
  leg: CourseLeg;
};

export type Climb = {
  startIndex: number;
  topIndex: number;
  startKm: number;
  topKm: number;
  lengthKm: number;
  gainM: number;
  gradePct: number;
  topEleM: number;
};

export type CourseStats = {
  distanceKm: number;
  ascentM: number;
  descentM: number;
  maxEleM: number;
};

export type CourseOverviewModel = {
  figure: { data: Data[]; layoutFor: (cameraScale: number) => Partial<Layout> };
  stats: CourseStats;
  climbs: Climb[];
};

/** Resampling step along the course. 200 m keeps the climbs crisp and the mesh light. */
const STEP_M = 200;
/** A climb ends once the road drops this far below its highest point. */
const CLIMB_END_DROP_M = 25;
/** Flat stretches (< 1 % over 2 km) split a long ascent into separate climbs. */
const FLAT_WINDOW_SAMPLES = 10;
const FLAT_GRADE = 0.01;
const MIN_CLIMB_GAIN_M = 80;
const MIN_CLIMB_LENGTH_M = 800;
/** Black Shirt cut-off at Stavsro, measured on the run (since 2024). */
const CUTOFF_RUN_KM = 37.5;

/** Gradient classes for the wall – same language as Model Accuracy (blue = down, purple = up). */
export const COURSE_SLOPE_CLASSES = [
  { key: "steepDescent", label: "Descent > 4 %", color: "#29c4f2", test: (g: number) => g <= -4 },
  { key: "descent", label: "Descent 1–4 %", color: "#1f8fe0", test: (g: number) => g <= -1 },
  { key: "flat", label: "Flat ±1 %", color: "#8a929b", test: (g: number) => g < 1 },
  { key: "climb", label: "Climb 1–4 %", color: "#e45bc0", test: (g: number) => g < 4 },
  { key: "steepClimb", label: "Climb 4–8 %", color: "#9b2cf0", test: (g: number) => g < 8 },
  { key: "wall", label: "Climb > 8 %", color: "#5e10a8", test: () => true },
] as const;

function slopeClassIndex(gradePct: number) {
  const index = COURSE_SLOPE_CLASSES.findIndex((entry) => entry.test(gradePct));
  return index === -1 ? 2 : index;
}

function slopeColor(gradePct: number) {
  return COURSE_SLOPE_CLASSES[slopeClassIndex(gradePct)].color;
}

/**
 * Gradient class per segment, with very short runs (< 1 km) absorbed into
 * their neighbour so the wall shows calm, readable bands.
 */
function segmentClasses(samples: Sample[]) {
  const classes = samples
    .slice(0, -1)
    .map((sample, index) => slopeClassIndex((sample.gradePct + samples[index + 1].gradePct) / 2));
  const minRun = 5;
  for (let pass = 0; pass < 3; pass += 1) {
    let start = 0;
    while (start < classes.length) {
      let end = start;
      while (end + 1 < classes.length && classes[end + 1] === classes[start]) end += 1;
      const length = end - start + 1;
      if (length < minRun) {
        const previous = start > 0 ? classes[start - 1] : undefined;
        const next = end + 1 < classes.length ? classes[end + 1] : undefined;
        const fill = previous ?? next;
        if (fill !== undefined) {
          for (let k = start; k <= end; k += 1) classes[k] = fill;
        }
      }
      start = end + 1;
    }
  }
  return classes;
}

export function parseGpx(text: string, leg: CourseLeg): RawPoint[] {
  const xml = new DOMParser().parseFromString(text, "application/xml");
  return [...xml.querySelectorAll("trkpt")]
    .map((point) => ({
      lat: Number(point.getAttribute("lat")),
      lon: Number(point.getAttribute("lon")),
      ele: Number(point.querySelector("ele")?.textContent ?? 0),
      leg,
    }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon));
}

function haversineMeters(a: RawPoint, b: RawPoint) {
  const radius = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

function computeStats(points: RawPoint[], totalDistanceM: number): CourseStats {
  let ascentM = 0;
  let descentM = 0;
  let maxEleM = Number.NEGATIVE_INFINITY;
  points.forEach((point, index) => {
    maxEleM = Math.max(maxEleM, point.ele);
    if (index === 0) {
      return;
    }
    const delta = point.ele - points[index - 1].ele;
    if (delta > 0) {
      ascentM += delta;
    } else {
      descentM -= delta;
    }
  });
  return { distanceKm: totalDistanceM / 1000, ascentM, descentM, maxEleM };
}

/** Projects lat/lon to metres and rotates the course so start → finish runs along +x. */
function projectAndRotate(points: RawPoint[]) {
  const meanLat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const meanLon = points.reduce((sum, point) => sum + point.lon, 0) / points.length;
  const lonFactor = Math.cos((meanLat * Math.PI) / 180) * 111320;
  const latFactor = 110540;
  const flat = points.map((point) => ({
    x: (point.lon - meanLon) * lonFactor,
    y: (point.lat - meanLat) * latFactor,
  }));
  const first = flat[0];
  const last = flat[flat.length - 1];
  const angle = Math.atan2(last.y - first.y, last.x - first.x);
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  return flat.map((point) => ({
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  }));
}

function resample(points: RawPoint[]): { samples: Sample[]; totalDistanceM: number } {
  const xy = projectAndRotate(points);
  const cumulative = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulative.push(cumulative[index - 1] + haversineMeters(points[index - 1], points[index]));
  }
  const totalDistanceM = cumulative[cumulative.length - 1];

  const samples: Sample[] = [];
  let cursor = 0;
  for (let target = 0; target <= totalDistanceM; target += STEP_M) {
    while (cursor < cumulative.length - 2 && cumulative[cursor + 1] < target) {
      cursor += 1;
    }
    const span = Math.max(cumulative[cursor + 1] - cumulative[cursor], 1e-9);
    const t = Math.min(Math.max((target - cumulative[cursor]) / span, 0), 1);
    const a = points[cursor];
    const b = points[cursor + 1];
    samples.push({
      distanceM: target,
      x: xy[cursor].x + (xy[cursor + 1].x - xy[cursor].x) * t,
      y: xy[cursor].y + (xy[cursor + 1].y - xy[cursor].y) * t,
      ele: a.ele + (b.ele - a.ele) * t,
      smoothEle: 0,
      gradePct: 0,
      leg: t < 0.5 ? a.leg : b.leg,
    });
  }

  // Light smoothing removes GPS noise without flattening the real climbs.
  const radius = 2;
  samples.forEach((sample, index) => {
    let sum = 0;
    let count = 0;
    for (let k = Math.max(0, index - radius); k <= Math.min(samples.length - 1, index + radius); k += 1) {
      sum += samples[k].ele;
      count += 1;
    }
    sample.smoothEle = sum / count;
  });
  // Gradient over ±600 m so the shading shows coherent climbs instead of noise stripes.
  samples.forEach((sample, index) => {
    const lo = Math.max(0, index - 3);
    const hi = Math.min(samples.length - 1, index + 3);
    const run = samples[hi].distanceM - samples[lo].distanceM;
    sample.gradePct = run > 0 ? ((samples[hi].smoothEle - samples[lo].smoothEle) / run) * 100 : 0;
  });

  return { samples, totalDistanceM };
}

function splitAtFlats(samples: Sample[], lo: number, hi: number): Array<[number, number]> {
  const segments: Array<[number, number]> = [];
  let segmentStart = lo;
  let index = lo;
  while (index + FLAT_WINDOW_SAMPLES <= hi) {
    const rise = samples[index + FLAT_WINDOW_SAMPLES].smoothEle - samples[index].smoothEle;
    if (rise < FLAT_GRADE * FLAT_WINDOW_SAMPLES * STEP_M) {
      let end = index + FLAT_WINDOW_SAMPLES;
      while (
        end + 1 <= hi &&
        samples[end + 1].smoothEle - samples[index].smoothEle < FLAT_GRADE * (end + 1 - index) * STEP_M
      ) {
        end += 1;
      }
      if (index > segmentStart) {
        segments.push([segmentStart, index]);
      }
      segmentStart = end;
      index = end;
    } else {
      index += 1;
    }
  }
  if (hi > segmentStart) {
    segments.push([segmentStart, hi]);
  }
  return segments;
}

export function detectClimbs(samples: Sample[]): Climb[] {
  const raw: Array<[number, number]> = [];
  let low = 0;
  let high = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const ele = samples[index].smoothEle;
    if (ele < samples[low].smoothEle && high === low) {
      low = index;
      high = index;
      continue;
    }
    if (ele > samples[high].smoothEle) {
      high = index;
    }
    if (samples[high].smoothEle - ele > CLIMB_END_DROP_M) {
      raw.push([low, high]);
      low = index;
      high = index;
    } else if (ele < samples[low].smoothEle) {
      low = index;
      high = index;
    }
  }
  raw.push([low, high]);

  const climbs: Climb[] = [];
  for (const [lo, hi] of raw) {
    for (const [segmentLo, segmentHi] of splitAtFlats(samples, lo, hi)) {
      let start = segmentLo;
      let top = segmentLo;
      for (let k = segmentLo; k <= segmentHi; k += 1) {
        if (samples[k].smoothEle < samples[start].smoothEle) start = k;
      }
      for (let k = start; k <= segmentHi; k += 1) {
        if (samples[k].smoothEle > samples[top].smoothEle || top < start) top = k;
      }
      // Skip a flat run-in so the average gradient describes the actual climb.
      while (start < top - 5 && samples[start + 5].smoothEle - samples[start].smoothEle < 10) {
        start += 1;
      }
      const gainM = samples[top].smoothEle - samples[start].smoothEle;
      const lengthM = samples[top].distanceM - samples[start].distanceM;
      if (gainM < MIN_CLIMB_GAIN_M || lengthM < MIN_CLIMB_LENGTH_M) {
        continue;
      }
      climbs.push({
        startIndex: start,
        topIndex: top,
        startKm: samples[start].distanceM / 1000,
        topKm: samples[top].distanceM / 1000,
        lengthKm: lengthM / 1000,
        gainM,
        gradePct: (gainM / lengthM) * 100,
        topEleM: samples[top].smoothEle,
      });
    }
  }
  return climbs;
}

/**
 * Default camera: from the south side, about 25° above the horizon and slightly
 * from the start. Chosen after comparing several angles – it shows the whole
 * course left (Eidfjord) to right (Gaustatoppen), keeps every climb label in
 * frame and still shows the bends of the route in depth.
 * Double-click the chart to return to this view after rotating.
 */
export const COURSE_CAMERA = {
  eye: { x: -0.22, y: -1.82, z: 0.98 },
  center: { x: 0, y: 0, z: -0.22 },
  up: { x: 0, y: 0, z: 1 },
};

function buildFigure(samples: Sample[], climbs: Climb[]): CourseOverviewModel["figure"] {
  const n = samples.length;

  // Terrain wall: one quad (two triangles) per segment between route and sea level.
  const vx: number[] = [];
  const vy: number[] = [];
  const vz: number[] = [];
  for (const sample of samples) {
    vx.push(sample.x, sample.x);
    vy.push(sample.y, sample.y);
    vz.push(sample.smoothEle, 0);
  }
  const i: number[] = [];
  const j: number[] = [];
  const k: number[] = [];
  const facecolor: string[] = [];
  const classes = segmentClasses(samples);
  for (let index = 0; index < n - 1; index += 1) {
    const top = index * 2;
    const bottom = top + 1;
    const nextTop = top + 2;
    const nextBottom = top + 3;
    const color = COURSE_SLOPE_CLASSES[classes[index]].color;
    i.push(top, bottom);
    j.push(bottom, nextBottom);
    k.push(nextTop, nextTop);
    facecolor.push(color, color);
  }

  const kmLabel = (sample: Sample) => (sample.distanceM / 1000).toFixed(1);
  const legBreaks = samples.reduce<number[]>((acc, sample, index) => {
    if (index > 0 && sample.leg !== samples[index - 1].leg) acc.push(index);
    return acc;
  }, []);
  const swimEnd = legBreaks[0] ?? 0;

  const data: Data[] = [
    {
      type: "mesh3d",
      x: vx,
      y: vy,
      z: vz,
      i,
      j,
      k,
      facecolor,
      flatshading: true,
      lighting: { ambient: 0.82, diffuse: 0.32, specular: 0.04, roughness: 0.95, fresnel: 0.05 },
      hoverinfo: "skip",
      showscale: false,
      name: "Course wall",
      showlegend: false,
    } as unknown as Data,
    {
      // Footprint of the route on the ground – shows the map shape of the course.
      type: "scatter3d",
      mode: "lines",
      x: samples.map((sample) => sample.x),
      y: samples.map((sample) => sample.y),
      z: samples.map(() => 0),
      line: { color: "rgba(255, 255, 255, 0.30)", width: 2 },
      hoverinfo: "skip",
      showlegend: false,
    } as Data,
    {
      // The route itself, drawn on top of the wall.
      type: "scatter3d",
      mode: "lines",
      x: samples.map((sample) => sample.x),
      y: samples.map((sample) => sample.y),
      z: samples.map((sample) => sample.smoothEle + 6),
      line: { color: "#ffffff", width: 5 },
      customdata: samples.map((sample) => [kmLabel(sample), sample.leg, sample.gradePct.toFixed(1)]),
      hovertemplate:
        "<b>%{customdata[1]}</b> · km %{customdata[0]}<br>" +
        "Elevation %{z:.0f} m<br>Gradient %{customdata[2]} %<extra></extra>",
      showlegend: false,
    } as Data,
    {
      type: "scatter3d",
      mode: "lines",
      x: samples.slice(0, swimEnd + 1).map((sample) => sample.x),
      y: samples.slice(0, swimEnd + 1).map((sample) => sample.y),
      z: samples.slice(0, swimEnd + 1).map(() => 6),
      line: { color: PALETTE.swim, width: 9 },
      hoverinfo: "skip",
      showlegend: false,
    } as Data,
  ];

  // Climb labels sit right at the summit. Labels that would collide are
  // staggered vertically.
  let lastTopX = Number.NEGATIVE_INFINITY;
  let stagger = 0;
  const xSpan = samples[n - 1].x - samples[0].x || 1;
  const climbAnnotations = climbs.map((climb) => {
    const top = samples[climb.topIndex];
    const close = Math.abs(top.x - lastTopX) < xSpan * 0.12;
    stagger = close ? (stagger + 1) % 3 : 0;
    lastTopX = top.x;
    const color = slopeColor(climb.gradePct);
    return {
      x: top.x,
      y: top.y,
      z: top.smoothEle + 10,
      text:
        `<b>${climb.lengthKm.toFixed(1)} km · ${climb.gradePct.toFixed(1)} %</b>` +
        `<br><span style="font-size:10px">+${Math.round(climb.gainM)} m · km ${climb.startKm.toFixed(0)}–${climb.topKm.toFixed(0)}</span>`,
      showarrow: true,
      arrowhead: 0,
      arrowwidth: 1.5,
      arrowcolor: "rgba(255, 255, 255, 0.85)",
      ax: 0,
      ay: [-40, -82, -124][stagger],
      bgcolor: "rgba(12, 14, 17, 0.88)",
      bordercolor: color,
      borderwidth: 2,
      borderpad: 4,
      font: { color: "#ffffff", size: 11 },
      align: "center",
    };
  });

  const markerAnnotation = (sample: Sample, text: string, ax: number, ay: number) => ({
    x: sample.x,
    y: sample.y,
    z: sample.smoothEle + 10,
    text,
    showarrow: true,
    arrowhead: 0,
    arrowwidth: 1,
    arrowcolor: "rgba(255, 255, 255, 0.6)",
    ax,
    ay,
    bgcolor: "rgba(255, 255, 255, 0.92)",
    borderpad: 3,
    font: { color: "#0a0c0e", size: 10 },
  });
  // Orange X at the Black Shirt cut-off (Stavsro, 37.5 km into the run).
  const runStart = legBreaks[1];
  const cutoffIndex =
    runStart === undefined
      ? -1
      : samples.findIndex(
          (sample) => sample.distanceM >= samples[runStart].distanceM + CUTOFF_RUN_KM * 1000,
        );
  const cutoff = cutoffIndex >= 0 ? samples[cutoffIndex] : null;
  if (cutoff) {
    data.push(
      {
        type: "scatter3d",
        mode: "lines",
        x: [cutoff.x, cutoff.x],
        y: [cutoff.y, cutoff.y],
        z: [0, cutoff.smoothEle + 6],
        line: { color: PALETTE.accent, width: 4, dash: "dash" },
        hoverinfo: "skip",
        showlegend: false,
      } as Data,
      {
        type: "scatter3d",
        mode: "markers",
        x: [cutoff.x],
        y: [cutoff.y],
        z: [cutoff.smoothEle + 8],
        marker: { symbol: "x", size: 13, color: PALETTE.accent, line: { color: PALETTE.accent, width: 3 } },
        hovertemplate:
          `<b>Black Shirt cut-off</b> · Stavsro (since 2024; 2018–2022: Langefonn, run 32.5 km)<br>Run ${CUTOFF_RUN_KM} km · race km ${(cutoff.distanceM / 1000).toFixed(1)}` +
          `<br>Elevation %{z:.0f} m<extra></extra>`,
        showlegend: false,
      } as Data,
    );
  }

  const legAnnotations = [
    markerAnnotation(samples[0], "<b>Start</b> · Eidfjord", -40, 26),
    ...(legBreaks[0] !== undefined ? [markerAnnotation(samples[legBreaks[0]], "<b>T1</b>", 18, 26)] : []),
    ...(legBreaks[1] !== undefined ? [markerAnnotation(samples[legBreaks[1]], "<b>T2</b>", -10, 30)] : []),
    markerAnnotation(samples[n - 1], "<b>Finish</b> · Gaustatoppen", -30, 64),
    ...(cutoff
      ? [
          {
            ...markerAnnotation(cutoff, `<b>✕ Cut-off</b> · Stavsro ${CUTOFF_RUN_KM} km`, -95, 34),
            bgcolor: PALETTE.accent,
            arrowcolor: PALETTE.accent,
          },
        ]
      : []),
  ];

  const xs = samples.map((sample) => sample.x);
  const ys = samples.map((sample) => sample.y);
  const xExtent = Math.max(...xs) - Math.min(...xs);
  const yExtent = Math.max(...ys) - Math.min(...ys);
  const xRatio = 3;
  const yRatio = Math.max(0.55, Math.min(1.4, (yExtent / xExtent) * xRatio));
  const hiddenAxis = {
    visible: false,
    showgrid: false,
    zeroline: false,
    showbackground: false,
    showspikes: false,
    title: { text: "" },
  };

  const scene = (cameraScale: number) => ({
    aspectmode: "manual",
    aspectratio: { x: xRatio, y: yRatio, z: 0.8 },
    camera: {
      ...COURSE_CAMERA,
      eye: {
        x: COURSE_CAMERA.eye.x * cameraScale,
        y: COURSE_CAMERA.eye.y * cameraScale,
        z: COURSE_CAMERA.eye.z * cameraScale,
      },
    },
    dragmode: "turntable",
    xaxis: hiddenAxis,
    yaxis: hiddenAxis,
    zaxis: { ...hiddenAxis, range: [0, 1950] },
    annotations: [...legAnnotations, ...climbAnnotations],
  });

  return {
    data,
    layoutFor: (cameraScale: number) =>
      ({
        margin: { l: 0, r: 0, t: 0, b: 0 },
        showlegend: false,
        meta: { legend: "keep" },
        scene: scene(cameraScale),
      }) as Partial<Layout>,
  };
}

/** Panel shape (width / height) the default camera was tuned for. */
const REFERENCE_ASPECT = 2.55;

/**
 * Plotly fits a 3D scene to the panel height, so on narrower panels the course
 * would be cut off left and right. Stepping the camera back by the aspect
 * difference keeps Eidfjord and Gaustatoppen in frame at any window size.
 */
export function cameraScaleFor(width: number, height: number) {
  if (width <= 0 || height <= 0) {
    return 1;
  }
  return Math.min(Math.max(REFERENCE_ASPECT / (width / height), 1), 4);
}

export function buildCourseOverviewModel(legs: RawPoint[][]): CourseOverviewModel | null {
  const points = legs.flat();
  if (points.length < 2) {
    return null;
  }
  const { samples, totalDistanceM } = resample(points);
  const climbs = detectClimbs(samples).filter((climb) => samples[climb.topIndex].leg !== "Swim");
  return {
    figure: buildFigure(samples, climbs),
    stats: computeStats(points, totalDistanceM),
    climbs,
  };
}
