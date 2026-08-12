const EVENT_CONFIGS = [
  {
    id: "norseman",
    label: "Norseman",
    eyebrow: "Norseman Overall Course",
    heroTitle: "Route as a 3D Elevation Model",
    intro:
      "This view follows the reference image: a spatially projected route where elevation is visible directly in the course itself. Key climbing stats sit underneath the route.",
    overallTitle: "Norseman Overall Course",
    includeOverall: true,
    routes: [
      {
        id: "swim",
        label: "Swim",
        file: "/gpx-overview/norseman_swim.gpx",
        type: "Swim",
        accent: "#5b8f87"
      },
      {
        id: "bike",
        label: "Bike",
        file: "/gpx-overview/norseman_bike.gpx",
        type: "Bike",
        accent: "#cf6f37"
      },
      {
        id: "run",
        label: "Run",
        file: "/gpx-overview/norseman_run.gpx",
        type: "Run",
        accent: "#7f5d48"
      }
    ]
  }
];

const canvas = document.getElementById("route-canvas");
const ctx = canvas.getContext("2d");
const eventEyebrowEl = document.getElementById("event-eyebrow");
const eventTitleEl = document.getElementById("event-title");
const eventIntroEl = document.getElementById("event-intro");
const eventSwitchEl = document.getElementById("event-switch");
const switchEl = document.getElementById("route-switch");
const messageEl = document.getElementById("message");
const titleEl = document.getElementById("route-title");
const subtitleEl = document.getElementById("route-subtitle");
const interactionHintEl = document.getElementById("canvas-interaction-hint");
const ascentEl = document.getElementById("ascent-value");
const distanceEl = document.getElementById("distance-value");
const descentEl = document.getElementById("descent-value");
const maxEleEl = document.getElementById("max-ele-value");
const elevationRangeEl = document.getElementById("elevation-range");
const profileEl = document.getElementById("elevation-profile");
const profileLegendEl = document.getElementById("profile-legend");
const profileHoverEl = document.getElementById("profile-hover");
const primaryStatLabelEl = document.getElementById("primary-stat-label");
const distanceLabelEl = document.getElementById("distance-label");
const descentLabelEl = document.getElementById("descent-label");
const maxEleLabelEl = document.getElementById("max-ele-label");

let loadedEvents = [];
let activeEventId = "norseman";
let activeRouteId = "overall";
let activeRoute = null;
let profileHoverState = null;

const cameraState = {
  rotation: null,
  yaw: 0,
  pitch: 0,
  zoom: 1,
  dragging: false,
  pointerId: null,
  lastX: 0,
  lastY: 0,
  overallUnlocked: false
};

const DRAG_YAW_RANGE = Math.PI * 0.75;
const DRAG_PITCH_RANGE = Math.PI * 0.55;
const OVERALL_VERTICAL_TILT_LIMIT = degreesToRadians(90);
const FREE_ORBIT_PITCH_LIMIT = degreesToRadians(85);

function degreesToRadians(value) {
  return (value * Math.PI) / 180;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeVector(vector) {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length
  };
}

function rotationMatrixX(angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return [1, 0, 0, 0, cos, -sin, 0, sin, cos];
}

function rotationMatrixZ(angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return [cos, -sin, 0, sin, cos, 0, 0, 0, 1];
}

function multiplyMatrices(a, b) {
  return [
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
    a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
    a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
    a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
    a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
    a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
    a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
    a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
    a[6] * b[2] + a[7] * b[5] + a[8] * b[8]
  ];
}

function applyRotationMatrix(matrix, point) {
  return {
    x: matrix[0] * point.x + matrix[1] * point.y + matrix[2] * point.z,
    y: matrix[3] * point.x + matrix[4] * point.y + matrix[5] * point.z,
    z: matrix[6] * point.x + matrix[7] * point.y + matrix[8] * point.z
  };
}


function buildDefaultRotation(yaw, pitch) {
  return multiplyMatrices(rotationMatrixX(pitch), rotationMatrixZ(yaw));
}

cameraState.yaw = -0.88;
cameraState.pitch = degreesToRadians(46);
cameraState.rotation = buildDefaultRotation(cameraState.yaw, cameraState.pitch);

function getDefaultCamera(route) {
  if (route?.id === "compare") {
    return {
      yaw: -0.82,
      pitch: degreesToRadians(24),
      zoom: 0.96
    };
  }

  if (route?.id === "overall") {
    return {
      yaw: -0.03,
      pitch: degreesToRadians(11),
      zoom: 1.92
    };
  }

  return {
    yaw: -0.56,
    pitch: degreesToRadians(30),
    zoom: 1.02
  };
}

function applyDefaultCamera(route) {
  const defaults = getDefaultCamera(route);
  cameraState.yaw = defaults.yaw;
  cameraState.pitch = defaults.pitch;
  cameraState.rotation = buildDefaultRotation(cameraState.yaw, cameraState.pitch);
  cameraState.zoom = defaults.zoom;
  cameraState.overallUnlocked = route?.id !== "overall";
  updateCanvasInteractionHint(route);
}

function hasLockedOverallPreview(route) {
  return route?.id === "overall" && !cameraState.overallUnlocked;
}

function updateCameraFromDrag(deltaX, deltaY) {
  const { width, height } = canvas.getBoundingClientRect();
  const safeHeight = Math.max(height, 320);

  if (hasLockedOverallPreview(activeRoute)) {
    return;
  }

  if (activeRoute?.id === "overall") {
    const defaults = getDefaultCamera(activeRoute);
    cameraState.yaw = defaults.yaw;
    cameraState.pitch -= (deltaY / safeHeight) * DRAG_PITCH_RANGE;
    cameraState.pitch = clamp(
      cameraState.pitch,
      defaults.pitch - OVERALL_VERTICAL_TILT_LIMIT,
      defaults.pitch + OVERALL_VERTICAL_TILT_LIMIT
    );
    cameraState.rotation = buildDefaultRotation(cameraState.yaw, cameraState.pitch);
    return;
  }

  const safeWidth = Math.max(width, 320);
  cameraState.yaw += (deltaX / safeWidth) * DRAG_YAW_RANGE;
  cameraState.pitch -= (deltaY / safeHeight) * DRAG_PITCH_RANGE;
  cameraState.pitch = clamp(cameraState.pitch, degreesToRadians(0), degreesToRadians(85));

  cameraState.rotation = buildDefaultRotation(cameraState.yaw, cameraState.pitch);
}

function updateCanvasInteractionHint(route) {
  const canvasStageEl = canvas.closest(".canvas-stage");
  const showHint = route?.id === "overall" && !cameraState.overallUnlocked;

  canvas.classList.toggle("is-preview-locked", showHint);
  canvasStageEl?.classList.toggle("is-preview-locked", showHint);

  if (interactionHintEl) {
    interactionHintEl.hidden = !showHint;
  }
}

function setMessage(text) {
  if (!text) {
    messageEl.hidden = true;
    messageEl.textContent = "";
    return;
  }

  messageEl.hidden = false;
  messageEl.textContent = text;
}

function parseGpx(xmlText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "application/xml");
  const points = [...xml.querySelectorAll("trkpt")].map((point) => ({
    lat: Number(point.getAttribute("lat")),
    lon: Number(point.getAttribute("lon")),
    ele: Number(point.querySelector("ele")?.textContent ?? 0)
  }));

  const title =
    xml.querySelector("metadata > name")?.textContent?.trim() ||
    xml.querySelector("trk > name")?.textContent?.trim() ||
    "Unbekannte Route";

  return { title, points };
}

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

function buildMetrics(points) {
  let distance = 0;
  let ascent = 0;
  let descent = 0;
  let minEle = Infinity;
  let maxEle = -Infinity;

  points.forEach((point, index) => {
    minEle = Math.min(minEle, point.ele);
    maxEle = Math.max(maxEle, point.ele);

    if (index === 0) {
      return;
    }

    distance += haversineMeters(points[index - 1], point);
    const delta = point.ele - points[index - 1].ele;

    if (delta > 0) {
      ascent += delta;
    } else {
      descent += Math.abs(delta);
    }
  });

  return {
    distanceKm: distance / 1000,
    ascentM: ascent,
    descentM: descent,
    minEleM: minEle,
    maxEleM: maxEle
  };
}

function cumulativeDistances(points) {
  let total = 0;

  return points.map((point, index) => {
    if (index > 0) {
      total += haversineMeters(points[index - 1], point);
    }

    return {
      distanceM: total,
      ele: point.ele
    };
  });
}

function projectToMeters(points) {
  const meanLat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const lonFactor = Math.cos((meanLat * Math.PI) / 180) * 111320;
  const latFactor = 111320;
  const centerLat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const centerLon = points.reduce((sum, point) => sum + point.lon, 0) / points.length;

  return points.map((point) => ({
    x: (point.lon - centerLon) * lonFactor,
    y: (point.lat - centerLat) * latFactor,
    z: point.ele
  }));
}

function rotateForRaceView(points) {
  const first = points[0];
  const last = points[points.length - 1];
  const angle = Math.atan2(last.y - first.y, last.x - first.x);
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);

  const rotated = points.map((point) => ({
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
    z: point.z
  }));

  const minX = Math.min(...rotated.map((point) => point.x));
  const meanY = rotated.reduce((sum, point) => sum + point.y, 0) / rotated.length;

  return rotated.map((point) => ({
    x: point.x - minX,
    y: (point.y - meanY) * 0.72,
    z: point.z
  }));
}

function stitchPlotGroups(groups) {
  let cursorX = 0;
  let cursorY = 0;

  return groups.map((points) => {
    const first = points[0];
    const shifted = points.map((point) => ({
      x: point.x - first.x + cursorX,
      y: point.y - first.y + cursorY,
      z: point.z
    }));
    const last = shifted[shifted.length - 1];
    cursorX = last.x;
    cursorY = last.y;
    return shifted;
  });
}

function simplify(points, maxPoints = 900) {
  if (points.length <= maxPoints) {
    return points;
  }

  const step = (points.length - 1) / (maxPoints - 1);
  const result = [];

  for (let i = 0; i < maxPoints; i += 1) {
    result.push(points[Math.round(i * step)]);
  }

  return result;
}

function buildSingleRoute(route, parsed) {
  const metrics = buildMetrics(parsed.points);
  const distanceSamples = cumulativeDistances(parsed.points);

  return {
    ...route,
    ...parsed,
    metrics,
    plotGroups: [
      {
        label: route.label,
        accent: route.accent,
        points: simplify(projectToMeters(parsed.points))
      }
    ],
    profileGroups: [
      {
        label: route.label,
        accent: route.accent,
        samples: simplify(distanceSamples, 260)
      }
    ]
  };
}

function buildOverallRoute(routes, overallTitle) {
  let distanceOffsetM = 0;
  const stitchedGroups = stitchPlotGroups(
    routes.map((route) => rotateForRaceView(projectToMeters(route.points)))
  );

  const plotGroups = routes.map((route, index) => ({
    label: route.label,
    accent: route.accent,
    points: simplify(stitchedGroups[index])
  }));

  const profileGroups = routes.map((route) => {
    const samples = simplify(cumulativeDistances(route.points), 240).map((point) => ({
      distanceM: point.distanceM + distanceOffsetM,
      ele: point.ele
    }));
    distanceOffsetM += route.metrics.distanceKm * 1000;

    return {
      label: route.label,
      accent: route.accent,
      samples
    };
  });

  const metrics = routes.reduce(
    (acc, route) => ({
      distanceKm: acc.distanceKm + route.metrics.distanceKm,
      ascentM: acc.ascentM + route.metrics.ascentM,
      descentM: acc.descentM + route.metrics.descentM,
      minEleM: Math.min(acc.minEleM, route.metrics.minEleM),
      maxEleM: Math.max(acc.maxEleM, route.metrics.maxEleM)
    }),
    {
      distanceKm: 0,
      ascentM: 0,
      descentM: 0,
      minEleM: Infinity,
      maxEleM: -Infinity
    }
  );

  return {
    id: "overall",
    label: "Overall",
    title: overallTitle,
    type: "Swim + Bike + Run",
    subtitle: "From the black fjord at Eidfjord to the final mountain wall of Gaustatoppen.",
    accent: "#cf6f37",
    points: routes.flatMap((route) => route.points),
    metrics,
    plotGroups,
    profileGroups
  };
}

function smoothProfileSamples(samples, radius = 2) {
  return samples.map((sample, index) => {
    let sum = 0;
    let count = 0;

    for (
      let cursor = Math.max(0, index - radius);
      cursor <= Math.min(samples.length - 1, index + radius);
      cursor += 1
    ) {
      sum += samples[cursor].ele;
      count += 1;
    }

    return {
      ...sample,
      smoothEle: sum / count
    };
  });
}

function detectClimbCandidates(samples) {
  if (samples.length < 3) {
    return [];
  }

  const smoothed = smoothProfileSamples(samples);
  const rawClimbs = [];
  let trend = 0;
  let valleyIndex = 0;
  const epsilonM = 0.6;

  for (let index = 1; index < smoothed.length; index += 1) {
    const delta = smoothed[index].smoothEle - smoothed[index - 1].smoothEle;
    let nextTrend = trend;

    if (delta > epsilonM) {
      nextTrend = 1;
    } else if (delta < -epsilonM) {
      nextTrend = -1;
    }

    if (trend <= 0 && nextTrend === 1) {
      valleyIndex = Math.max(0, index - 1);
    } else if (trend === 1 && nextTrend === -1) {
      rawClimbs.push({
        startIndex: valleyIndex,
        endIndex: Math.max(valleyIndex + 1, index - 1)
      });
    }

    trend = nextTrend;
  }

  if (trend === 1) {
    rawClimbs.push({
      startIndex: valleyIndex,
      endIndex: samples.length - 1
    });
  }

  const mergedClimbs = [];

  rawClimbs.forEach((climb) => {
    const previous = mergedClimbs[mergedClimbs.length - 1];

    if (!previous) {
      mergedClimbs.push({ ...climb });
      return;
    }

    const gapDistanceM =
      samples[climb.startIndex].distanceM - samples[previous.endIndex].distanceM;
    const gapDropM = samples[previous.endIndex].ele - samples[climb.startIndex].ele;

    if (gapDistanceM <= 700 && gapDropM <= 16) {
      previous.endIndex = climb.endIndex;
      return;
    }

    mergedClimbs.push({ ...climb });
  });

  return mergedClimbs.map((climb) => {
    const start = samples[climb.startIndex];
    const end = samples[climb.endIndex];
    const distanceM = Math.max(end.distanceM - start.distanceM, 1);
    const ascentM = end.ele - start.ele;
    const gradePct = (ascentM / distanceM) * 100;

    return {
      ...climb,
      startDistanceM: start.distanceM,
      endDistanceM: end.distanceM,
      distanceM,
      ascentM,
      gradePct
    };
  });
}

function buildClimbAnnotations(route) {
  const maxClimbs = route.id === "overall" ? 16 : route.profileMode === "overlay" ? 12 : 10;
  const minAscentM =
    route.id === "overall"
      ? Math.min(42, Math.max(16, route.metrics.ascentM * 0.004))
      : route.profileMode === "overlay"
        ? Math.min(48, Math.max(18, route.metrics.ascentM * 0.016))
        : Math.min(56, Math.max(22, route.metrics.ascentM * 0.02));
  const minDistanceM =
    route.id === "overall" ? 140 : route.profileMode === "overlay" ? 220 : 260;

  const climbs = route.profileGroups
    .flatMap((group) =>
      detectClimbCandidates(group.samples)
        .filter((climb) => climb.ascentM >= minAscentM && climb.distanceM >= minDistanceM)
        .map((climb) => ({
          ...climb,
          accent: group.accent
        }))
    )
    .sort((a, b) => a.startDistanceM - b.startDistanceM);

  if (climbs.length <= maxClimbs) {
    return climbs;
  }

  return climbs
    .slice()
    .sort((a, b) => b.distanceM - a.distanceM)
    .slice(0, maxClimbs)
    .sort((a, b) => a.startDistanceM - b.startDistanceM);
}

function assignClimbAnnotationLanes(climbs, totalDistanceM, width, padX) {
  const laneEnds = [];

  return climbs.map((climb) => {
    const startX = padX + (climb.startDistanceM / totalDistanceM) * (width - padX * 2);
    const endX = padX + (climb.endDistanceM / totalDistanceM) * (width - padX * 2);
    const minimumWidth = 58;
    const paddedEnd = Math.max(endX, startX + minimumWidth);
    let lane = laneEnds.findIndex((laneEnd) => startX > laneEnd + 12);

    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(paddedEnd);
    } else {
      laneEnds[lane] = paddedEnd;
    }

    return {
      ...climb,
      lane,
      startX,
      endX
    };
  });
}

function getProfileSegmentColor(gradePct) {
  if (gradePct >= 1.2) {
    return "#b12c24";
  }

  if (gradePct >= 0.18) {
    return "#d05b27";
  }

  if (gradePct <= -0.18) {
    return "#319467";
  }

  return "rgba(188, 164, 126, 0.68)";
}

function formatPercent(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function getNearestProfilePoint(samples, distanceM) {
  if (samples.length < 2) {
    return null;
  }

  let nearestIndex = 0;
  let nearestDelta = Math.abs(samples[0].distanceM - distanceM);

  for (let index = 1; index < samples.length; index += 1) {
    const delta = Math.abs(samples[index].distanceM - distanceM);

    if (delta < nearestDelta) {
      nearestDelta = delta;
      nearestIndex = index;
    }
  }

  const current = samples[nearestIndex];
  const previous = samples[Math.max(0, nearestIndex - 1)];
  const next = samples[Math.min(samples.length - 1, nearestIndex + 1)];
  const comparePoint = nearestIndex === 0 ? next : previous;
  const distanceDeltaM = Math.max(Math.abs(current.distanceM - comparePoint.distanceM), 1);
  const gradePct = ((current.ele - comparePoint.ele) / distanceDeltaM) * 100;

  return {
    sample: current,
    gradePct
  };
}

function hideProfileHover() {
  profileHoverEl.hidden = true;

  if (profileHoverState?.hoverLayerEl) {
    profileHoverState.hoverLayerEl.setAttribute("opacity", "0");
  }
}

function updateProfileHover(event) {
  if (!profileHoverState) {
    return;
  }

  const rect = profileEl.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return;
  }

  const relativeX = clamp(event.clientX - rect.left, 0, rect.width);
  const relativeY = clamp(event.clientY - rect.top, 0, rect.height);
  const xRatio = relativeX / rect.width;
  const distanceM = xRatio * profileHoverState.totalDistanceM;
  const activeGroups = profileHoverState.groups
    .map((group, index) => {
      const minDistanceM = group.samples[0]?.distanceM ?? 0;
      const maxDistanceM = group.samples[group.samples.length - 1]?.distanceM ?? 0;

      if (distanceM < minDistanceM || distanceM > maxDistanceM) {
        return null;
      }

      const nearest = getNearestProfilePoint(group.samples, distanceM);
      if (!nearest) {
        return null;
      }

      const x = profileHoverState.padX + (nearest.sample.distanceM / profileHoverState.totalDistanceM) * (
        profileHoverState.width - profileHoverState.padX * 2
      );
      const y =
        profileHoverState.height -
        profileHoverState.padBottom -
        ((nearest.sample.ele - profileHoverState.minEleM) / profileHoverState.range) *
          profileHoverState.plotHeight;

      return {
        index,
        label: group.label,
        accent: group.accent,
        distanceM: nearest.sample.distanceM,
        gradePct: nearest.gradePct,
        x,
        y
      };
    })
    .filter(Boolean);

  if (activeGroups.length === 0) {
    hideProfileHover();
    return;
  }

  const primaryPoint = activeGroups.reduce((closest, group) => {
    if (!closest) {
      return group;
    }

    return Math.abs(group.y - relativeY) < Math.abs(closest.y - relativeY) ? group : closest;
  }, null);
  const guideX = profileHoverState.padX + xRatio * (profileHoverState.width - profileHoverState.padX * 2);
  profileHoverState.hoverLayerEl.setAttribute("opacity", "1");
  profileHoverState.hoverLineEl.setAttribute("x1", guideX.toFixed(2));
  profileHoverState.hoverLineEl.setAttribute("x2", guideX.toFixed(2));

  profileHoverState.hoverPointEls.forEach((pointEl, index) => {
    const match = primaryPoint?.index === index ? primaryPoint : null;

    if (!match) {
      pointEl.setAttribute("opacity", "0");
      return;
    }

    pointEl.setAttribute("cx", match.x.toFixed(2));
    pointEl.setAttribute("cy", match.y.toFixed(2));
    pointEl.setAttribute("opacity", "1");
  });

  const distanceLabel = `${(primaryPoint.distanceM / 1000).toFixed(1)} km`;
  profileHoverEl.innerHTML = `<strong>${distanceLabel}</strong><span>${formatPercent(
    primaryPoint.gradePct
  )}</span>`;

  const wrapRect = profileHoverEl.parentElement.getBoundingClientRect();
  profileHoverEl.hidden = false;
  const hoverRect = profileHoverEl.getBoundingClientRect();
  const offsetX = 24;
  const offsetY = 24;
  const maxLeft = Math.max(16, wrapRect.width - hoverRect.width - 16);
  const maxTop = Math.max(16, wrapRect.height - hoverRect.height - 16);
  const preferredLeft = event.clientX - wrapRect.left + offsetX;
  const preferredTop = event.clientY - wrapRect.top - hoverRect.height - offsetY;
  const fallbackTop = event.clientY - wrapRect.top + 14;

  profileHoverEl.style.left = `${clamp(preferredLeft, 16, maxLeft)}px`;
  profileHoverEl.style.top = `${clamp(
    preferredTop < 16 ? fallbackTop : preferredTop,
    16,
    maxTop
  )}px`;
}

function getElevationBaseline(points, mode = "start") {
  if (mode === "min") {
    return Math.min(...points.map((point) => point.ele));
  }

  return points[0]?.ele ?? 0;
}

function normalizeComparePlot(points, baselineMode = "start") {
  const rotated = rotateForRaceView(projectToMeters(points));
  const first = rotated[0];
  const meanY = rotated.reduce((sum, point) => sum + point.y, 0) / rotated.length;
  const baseline = getElevationBaseline(points, baselineMode);

  return rotated.map((point) => ({
    x: point.x - first.x,
    y: point.y - meanY,
    z: point.z - baseline
  }));
}

function buildRelativeDistanceSamples(points, baselineMode = "start") {
  const baseline = getElevationBaseline(points, baselineMode);

  return cumulativeDistances(points).map((point) => ({
    distanceM: point.distanceM,
    ele: point.ele - baseline
  }));
}

function buildRelativeRouteView(route, options = {}) {
  const baselineMode = options.baselineMode ?? "start";
  const relativePoints = normalizeComparePlot(route.points, baselineMode);
  const relativeSamples = simplify(buildRelativeDistanceSamples(route.points, baselineMode), 260);
  const heights = relativePoints.map((point) => point.z);
  const isMinBaseline = baselineMode === "min";

  return {
    ...route,
    ...options,
    metrics: {
      ...route.metrics,
      minEleM: Math.min(...heights),
      maxEleM: Math.max(...heights)
    },
    subtitle: isMinBaseline
      ? "Normalized to the lowest point. 0 m always represents the lowest point of this route."
      : "Normalized to the start point. 0 m always represents the start of this route.",
    axisLabel: "Rel. Elevation",
    elevationRangeLabel: isMinBaseline ? "Relative to lowest point" : "Relative to start",
    showZeroLine: !isMinBaseline,
    plotGroups: [
      {
        label: options.label ?? route.label,
        accent: route.accent,
        points: simplify(relativePoints)
      }
    ],
    profileGroups: [
      {
        label: options.label ?? route.label,
        accent: route.accent,
        samples: relativeSamples
      }
    ]
  };
}

function buildComparisonRoute(primaryRoute, comparisonRoute) {
  const primaryLabel = primaryRoute.label ?? primaryRoute.title;
  const comparisonLabel = comparisonRoute.label ?? comparisonRoute.title;
  const primaryPoints = normalizeComparePlot(primaryRoute.points, "min");
  const comparisonPoints = normalizeComparePlot(comparisonRoute.points, "min");
  const primaryProfileSamples = simplify(buildRelativeDistanceSamples(primaryRoute.points, "min"), 260);
  const comparisonProfileSamples = simplify(
    buildRelativeDistanceSamples(comparisonRoute.points, "min"),
    260
  );
  const primarySpanY =
    Math.max(...primaryPoints.map((point) => point.y)) -
    Math.min(...primaryPoints.map((point) => point.y));
  const comparisonSpanY =
    Math.max(...comparisonPoints.map((point) => point.y)) -
    Math.min(...comparisonPoints.map((point) => point.y));
  const separation = Math.max(110, Math.max(primarySpanY, comparisonSpanY) * 0.55);
  const normalizedHeights = [
    ...primaryPoints.map((point) => point.z),
    ...comparisonPoints.map((point) => point.z)
  ];
  const metrics = {
    distanceKm: Math.max(primaryRoute.metrics.distanceKm, comparisonRoute.metrics.distanceKm),
    ascentM: Math.max(primaryRoute.metrics.ascentM, comparisonRoute.metrics.ascentM),
    descentM: Math.max(primaryRoute.metrics.descentM, comparisonRoute.metrics.descentM),
    minEleM: Math.min(...normalizedHeights),
    maxEleM: Math.max(...normalizedHeights)
  };

  return {
    id: "compare",
    label: "Compare",
    title: "Yesterday vs. IM 70.3 Porec Bike",
    type: "Bike Comparison",
    accent: comparisonRoute.accent,
    points: [...primaryRoute.points, ...comparisonRoute.points],
    metrics,
    subtitle:
      "Both routes start at their own lowest point in this comparison, so you can compare the climbs without absolute elevation bias.",
    showGroupLabels: true,
    showProfileLegend: true,
    profileMode: "overlay",
    showZeroLine: false,
    axisLabel: "Rel. Elevation",
    elevationRangeLabel: "Relative to lowest point",
    plotGroups: [
      {
        label: primaryLabel,
        accent: primaryRoute.accent,
        points: simplify(
          primaryPoints.map((point) => ({
            x: point.x,
            y: point.y - separation / 2,
            z: point.z
          }))
        )
      },
      {
        label: comparisonLabel,
        accent: comparisonRoute.accent,
        points: simplify(
          comparisonPoints.map((point) => ({
            x: point.x,
            y: point.y + separation / 2,
            z: point.z
          }))
        )
      }
    ],
    profileGroups: [
      {
        label: primaryLabel,
        accent: primaryRoute.accent,
        samples: primaryProfileSamples
      },
      {
        label: comparisonLabel,
        accent: comparisonRoute.accent,
        samples: comparisonProfileSamples
      }
    ],
    stats: {
      primaryLabel: "Elevation Gain Yesterday / Porec",
      primaryValue: `${formatMeters(comparisonRoute.metrics.ascentM)} / ${formatMeters(
        primaryRoute.metrics.ascentM
      )}`,
      distanceLabel: "Distance Yesterday / Porec",
      distanceValue: `${formatDistance(comparisonRoute.metrics.distanceKm)} / ${formatDistance(
        primaryRoute.metrics.distanceKm
      )}`,
      descentLabel: "Descent Yesterday / Porec",
      descentValue: `${formatMeters(comparisonRoute.metrics.descentM)} / ${formatMeters(
        primaryRoute.metrics.descentM
      )}`,
      maxEleLabel: "Max Above Low Point Y / P",
      maxEleValue: `${formatMeters(Math.max(...comparisonPoints.map((point) => point.z)))} / ${formatMeters(
        Math.max(...primaryPoints.map((point) => point.z))
      )}`
    }
  };
}

function buildEventViews(event, baseRoutes) {
  const includeOverall = event.includeOverall ?? baseRoutes.length > 1;

  return {
    ...event,
    views: includeOverall ? [buildOverallRoute(baseRoutes, event.overallTitle), ...baseRoutes] : baseRoutes
  };
}

function buildComparisonEvent(events) {
  const porecEvent = events.find((event) => event.id === "porec");
  const yesterdayEvent = events.find((event) => event.id === "gestern");
  const porecBike = porecEvent?.views.find((view) => view.id === "bike");
  const yesterdayBike = yesterdayEvent?.views.find((view) => view.id === "bike");

  if (!porecBike || !yesterdayBike) {
    return null;
  }

  const porecCompareView = {
    ...buildRelativeRouteView(porecBike, {
      id: "porec-bike",
      label: "Porec Bike",
      baselineMode: "min"
    }),
    id: "porec-bike",
    label: "Porec Bike"
  };
  const yesterdayCompareView = {
    ...buildRelativeRouteView(yesterdayBike, {
      id: "gestern-bike",
      label: "Yesterday Bike",
      baselineMode: "min"
    }),
    id: "gestern-bike",
    label: "Yesterday Bike"
  };

  return {
    id: "compare",
    label: "Compare",
    eyebrow: "Bike Comparison",
    heroTitle: "Compare Porec and Yesterday Directly",
    intro:
      "Your ride from yesterday and the IM 70.3 Porec bike course are shown together in one 3D view. The elevation profile below is overlaid so the climbs stay directly comparable.",
    views: [
      buildComparisonRoute(porecCompareView, yesterdayCompareView),
      porecCompareView,
      yesterdayCompareView
    ]
  };
}

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function createProjector(points, width, height, route) {
  const bounds = points.reduce(
    (acc, point) => ({
      minX: Math.min(acc.minX, point.x),
      maxX: Math.max(acc.maxX, point.x),
      minY: Math.min(acc.minY, point.y),
      maxY: Math.max(acc.maxY, point.y),
      minZ: Math.min(acc.minZ, point.z),
      maxZ: Math.max(acc.maxZ, point.z)
    }),
    {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity,
      minZ: Infinity,
      maxZ: -Infinity
    }
  );

  const spanX = Math.max(bounds.maxX - bounds.minX, 1);
  const spanY = Math.max(bounds.maxY - bounds.minY, 1);
  const spanZ = Math.max(bounds.maxZ - bounds.minZ, 1);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const centerZ = bounds.minZ + spanZ / 2;
  const isOverallRoute = route?.id === "overall";
  const paddingX = spanX * (isOverallRoute ? 0.028 : 0.08);
  const paddingY = spanY * (isOverallRoute ? 0.1 : 0.18);
  const horizontalPad = isOverallRoute ? 15 : width * 0.03;
  const verticalPad = height * (isOverallRoute ? 0.06 : 0.1);
  const availableWidth = width - horizontalPad * 2;
  const availableHeight = height - verticalPad * 2;
  const radiusX = (spanX + paddingX * 2) / 2;
  const radiusY = (spanY + paddingY * 2) / 2;
  const radiusZ = spanZ * 1.1;
  const modelRadius = Math.sqrt(radiusX ** 2 + radiusY ** 2 + radiusZ ** 2);
  const scaleBase =
    Math.min(
      availableWidth / Math.max(modelRadius * 2.2, 1),
      availableHeight / Math.max(modelRadius * 2.1, 1)
    ) * cameraState.zoom;
  const rotation = cameraState.rotation ?? buildDefaultRotation(-0.74, degreesToRadians(28));
  const perspectiveDistance = modelRadius * 2.6;
  let scale = isOverallRoute ? scaleBase * 1.12 : scaleBase;
  const baseZ = bounds.minZ;
  const verticalScale = isOverallRoute ? 1.22 : 1.95;

  const rawProjectAtScale = (point, zOverride, scaleValue) => {
    const z = typeof zOverride === "number" ? zOverride : point.z;
    const rotated = applyRotationMatrix(rotation, {
      x: point.x - centerX,
      y: point.y - centerY,
      z: z - centerZ
    });
    const depth = rotated.y;
    const perspective = isOverallRoute
      ? 1
      : perspectiveDistance /
        Math.max(perspectiveDistance + depth * 0.58, perspectiveDistance * 0.34);

    return {
      x: rotated.x * scaleValue * perspective,
      y: -(rotated.z * verticalScale) * scaleValue * perspective,
      depth
    };
  };

  if (isOverallRoute) {
    const projectOverallAtPitch = (point, pitchValue) => {
      const defaults = getDefaultCamera(route);
      const rotationAtPitch = buildDefaultRotation(defaults.yaw, pitchValue);
      const rotated = applyRotationMatrix(rotationAtPitch, {
        x: point.x - centerX,
        y: point.y - centerY,
        z: point.z - centerZ
      });

      return {
        x: rotated.x,
        y: -(rotated.z * verticalScale)
      };
    };
    const defaults = getDefaultCamera(route);
    const startUnit = projectOverallAtPitch(points[0], defaults.pitch);
    const endUnit = projectOverallAtPitch(points[points.length - 1], defaults.pitch);
    const routeWidthAtUnit = Math.max(Math.abs(endUnit.x - startUnit.x), 1);
    const widthScale = (width - 18) / routeWidthAtUnit;
    scale = widthScale * 0.998;
  }

  const rawProject = (point, zOverride) => rawProjectAtScale(point, zOverride, scale);
  const centeringSamples = [
    ...points,
    { x: bounds.minX - paddingX, y: bounds.minY - paddingY, z: baseZ },
    { x: bounds.maxX + paddingX, y: bounds.minY - paddingY, z: baseZ },
    { x: bounds.maxX + paddingX, y: bounds.maxY + paddingY, z: baseZ },
    { x: bounds.minX - paddingX, y: bounds.maxY + paddingY, z: baseZ }
  ].map((point) => rawProject(point, point.z));
  const projectedBounds = centeringSamples.reduce(
    (acc, point) => ({
      minX: Math.min(acc.minX, point.x),
      maxX: Math.max(acc.maxX, point.x),
      minY: Math.min(acc.minY, point.y),
      maxY: Math.max(acc.maxY, point.y)
    }),
    {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity
    }
  );
  const routeProjectedBounds = points
    .map((point) => rawProject(point, point.z))
    .reduce(
      (acc, point) => ({
        minX: Math.min(acc.minX, point.x),
        maxX: Math.max(acc.maxX, point.x),
        minY: Math.min(acc.minY, point.y),
        maxY: Math.max(acc.maxY, point.y)
      }),
      {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity
      }
    );
  const projectedStart = rawProject(points[0], points[0].z);
  const anchorX = isOverallRoute
    ? 4 - projectedStart.x
    : width * 0.5 - (projectedBounds.minX + projectedBounds.maxX) / 2;
  const anchorY = isOverallRoute
    ? height * 0.52 - (routeProjectedBounds.minY + routeProjectedBounds.maxY) / 2
    : height * 0.54 - (projectedBounds.minY + projectedBounds.maxY) / 2;

  const project = (point, zOverride) => {
    const projected = rawProject(point, zOverride);

    return {
      x: projected.x + anchorX,
      y: projected.y + anchorY,
      depth: projected.depth
    };
  };

  return { bounds, project, baseZ, paddingX, paddingY };
}

function drawFloor(ctx2d, projector, width, height) {
  const { bounds, project, baseZ, paddingX, paddingY } = projector;
  const corners = [
    { x: bounds.minX - paddingX, y: bounds.minY - paddingY, z: baseZ },
    { x: bounds.maxX + paddingX, y: bounds.minY - paddingY, z: baseZ },
    { x: bounds.maxX + paddingX, y: bounds.maxY + paddingY, z: baseZ },
    { x: bounds.minX - paddingX, y: bounds.maxY + paddingY, z: baseZ }
  ].map((point) => project(point, baseZ));

  const floorGradient = ctx2d.createLinearGradient(0, height * 0.24, width, height);
  floorGradient.addColorStop(0, "rgba(228, 219, 198, 0.34)");
  floorGradient.addColorStop(1, "rgba(190, 178, 148, 0.18)");

  ctx2d.beginPath();
  corners.forEach((corner, index) => {
    if (index === 0) {
      ctx2d.moveTo(corner.x, corner.y);
    } else {
      ctx2d.lineTo(corner.x, corner.y);
    }
  });
  ctx2d.closePath();
  ctx2d.fillStyle = floorGradient;
  ctx2d.fill();

  ctx2d.strokeStyle = "rgba(107, 97, 80, 0.18)";
  ctx2d.lineWidth = 1;
  ctx2d.stroke();

  for (let i = 1; i < 6; i += 1) {
    const t = i / 6;
    const frontLeft = {
      x: bounds.minX - paddingX,
      y: bounds.minY - paddingY + (bounds.maxY - bounds.minY + paddingY * 2) * t
    };
    const frontRight = {
      x: bounds.maxX + paddingX,
      y: bounds.minY - paddingY + (bounds.maxY - bounds.minY + paddingY * 2) * t
    };

    const p1 = project({ ...frontLeft, z: baseZ }, baseZ);
    const p2 = project({ ...frontRight, z: baseZ }, baseZ);
    ctx2d.beginPath();
    ctx2d.moveTo(p1.x, p1.y);
    ctx2d.lineTo(p2.x, p2.y);
    ctx2d.strokeStyle = "rgba(107, 97, 80, 0.12)";
    ctx2d.stroke();
  }
}

function drawAxisCaptions(ctx2d, route, projector) {
  if (route?.id === "overall") {
    return;
  }

  const { bounds, project, baseZ } = projector;
  const leftBase = project({ x: bounds.minX, y: bounds.maxY, z: baseZ }, baseZ);
  const lowerBase = project({ x: bounds.maxX, y: bounds.maxY, z: baseZ }, baseZ);
  const upperBase = project(
    { x: bounds.minX, y: bounds.maxY, z: route.metrics.maxEleM },
    route.metrics.maxEleM
  );

  ctx2d.save();
  ctx2d.fillStyle = "rgba(77, 69, 57, 0.88)";
  ctx2d.font = "12px 'Avenir Next', 'Segoe UI', sans-serif";
  ctx2d.fillText("Distance", lowerBase.x - 34, lowerBase.y + 26);

  ctx2d.save();
  ctx2d.translate(leftBase.x - 22, leftBase.y - 8);
  ctx2d.rotate(-Math.PI / 2);
  ctx2d.fillText(route.axisLabel ?? "Hoehe", 0, 0);
  ctx2d.restore();

  ctx2d.font = "11px 'Avenir Next', 'Segoe UI', sans-serif";
  ctx2d.fillStyle = "rgba(77, 69, 57, 0.64)";
  ctx2d.fillText(`${Math.round(route.metrics.maxEleM)} m`, upperBase.x - 28, upperBase.y - 10);
  ctx2d.fillText(`${Math.round(route.metrics.minEleM)} m`, leftBase.x - 28, leftBase.y + 2);
  ctx2d.restore();
}

function drawRoute(route) {
  resizeCanvas();
  const width = canvas.getBoundingClientRect().width;
  const height = canvas.getBoundingClientRect().height;
  ctx.clearRect(0, 0, width, height);

  const allPoints = route.plotGroups.flatMap((group) => group.points);
  const projector = createProjector(allPoints, width, height, route);
  drawFloor(ctx, projector, width, height);

  const sideSegments = [];
  const projectedGroups = route.plotGroups.map((group) => {
    const topPoints = [];
    const shadowPoints = [];

    group.points.forEach((point, index) => {
      const top = projector.project(point);
      const base = projector.project(point, projector.baseZ);
      topPoints.push(top);
      shadowPoints.push(base);

      if (index === 0) {
        return;
      }

      const prev = group.points[index - 1];
      const prevTop = projector.project(prev);
      const prevBase = projector.project(prev, projector.baseZ);
      sideSegments.push({
        top1: prevTop,
        top2: top,
        base1: prevBase,
        base2: base,
        depth: (top.depth + base.depth + prevTop.depth + prevBase.depth) / 4,
        tone: point.z - projector.baseZ
      });
    });

    return { ...group, topPoints, shadowPoints };
  });

  sideSegments
    .sort((a, b) => b.depth - a.depth)
    .forEach((segment) => {
      const shade = Math.min(0.78, 0.28 + segment.tone / 2300);
      ctx.beginPath();
      ctx.moveTo(segment.base1.x, segment.base1.y);
      ctx.lineTo(segment.top1.x, segment.top1.y);
      ctx.lineTo(segment.top2.x, segment.top2.y);
      ctx.lineTo(segment.base2.x, segment.base2.y);
      ctx.closePath();
      ctx.fillStyle = `rgba(88, 90, 96, ${shade})`;
      ctx.fill();
      ctx.strokeStyle = "rgba(40, 41, 45, 0.1)";
      ctx.lineWidth = 0.6;
      ctx.stroke();
    });

  projectedGroups.forEach((group) => {
    ctx.beginPath();
    group.shadowPoints.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.strokeStyle = "rgba(78, 70, 58, 0.16)";
    ctx.lineWidth = 2.2;
    ctx.stroke();

    const gradient = ctx.createLinearGradient(
      group.topPoints[0].x,
      height * 0.12,
      group.topPoints[group.topPoints.length - 1].x,
      height * 0.84
    );
    gradient.addColorStop(0, "rgba(33, 37, 43, 0.95)");
    gradient.addColorStop(1, group.accent);

    ctx.beginPath();
    group.topPoints.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 3.2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  });

  const firstGroup = projectedGroups[0];
  const lastGroup = projectedGroups[projectedGroups.length - 1];
  const start = firstGroup.topPoints[0];
  const end = lastGroup.topPoints[lastGroup.topPoints.length - 1];

  [start, end].forEach((point, index) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, index === 0 ? 5 : 6, 0, Math.PI * 2);
    ctx.fillStyle = index === 0 ? "#ffffff" : route.accent;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(31, 36, 48, 0.55)";
    ctx.stroke();
  });

  if (route.id === "overall" || route.showGroupLabels) {
    projectedGroups.forEach((group) => {
      const mid = group.topPoints[Math.floor(group.topPoints.length / 2)];
      ctx.save();
      ctx.fillStyle = group.accent;
      ctx.font = "600 12px 'Avenir Next', 'Segoe UI', sans-serif";
      ctx.fillText(group.label.toUpperCase(), mid.x - 20, mid.y - 16);
      ctx.restore();
    });
  }

  drawAxisCaptions(ctx, route, projector);
}

function buildSmoothPath(points) {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  }

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    path += ` Q ${current.x.toFixed(2)} ${current.y.toFixed(2)} ${midX.toFixed(2)} ${midY.toFixed(2)}`;
  }

  const last = points[points.length - 1];
  const penultimate = points[points.length - 2];
  path += ` Q ${penultimate.x.toFixed(2)} ${penultimate.y.toFixed(2)} ${last.x.toFixed(2)} ${last.y.toFixed(2)}`;
  return path;
}

function renderProfile(route) {
  const width = 1000;
  const climbAnnotations = assignClimbAnnotationLanes(
    buildClimbAnnotations(route),
    Math.max(
      ...route.profileGroups.map((group) => group.samples[group.samples.length - 1]?.distanceM ?? 0),
      1
    ),
    width,
    10
  );
  const laneCount = climbAnnotations.reduce((maxLane, climb) => Math.max(maxLane, climb.lane + 1), 0);
  const annotationHeight = laneCount > 0 ? 14 + laneCount * 12 : 10;
  const height = 56 + annotationHeight + 12;
  const padX = 14;
  const padTop = annotationHeight;
  const padBottom = 12;
  const min = route.metrics.minEleM;
  const max = route.metrics.maxEleM;
  const range = Math.max(max - min, 1);
  const totalDistanceM = Math.max(
    ...route.profileGroups.map((group) => group.samples[group.samples.length - 1]?.distanceM ?? 0),
    1
  );
  const plotHeight = height - padTop - padBottom;
  const gridLines = [0.24, 0.52, 0.8]
    .map((ratio) => {
      const y = padTop + plotHeight * ratio;
      return `<line x1="${padX}" y1="${y.toFixed(2)}" x2="${width - padX}" y2="${y.toFixed(
        2
      )}" stroke="rgba(255,255,255,0.055)" stroke-width="1"></line>`;
    })
    .join("");

  const segmentMarkup = route.profileGroups
    .map((group) => {
      const renderedSamples = smoothProfileSamples(group.samples, route.id === "overall" ? 4 : 3).map(
        (point) => ({
          ...point,
          renderedEle: point.smoothEle ?? point.ele
        })
      );
      const plottedPoints = renderedSamples.map((point) => ({
        ...point,
        x: padX + (point.distanceM / totalDistanceM) * (width - padX * 2),
        y: height - padBottom - ((point.renderedEle - min) / range) * plotHeight
      }));
      const path = buildSmoothPath(plottedPoints);

      const last = renderedSamples[renderedSamples.length - 1];
      const first = renderedSamples[0];
      const fillPath = `${path} L ${
        padX + (last.distanceM / totalDistanceM) * (width - padX * 2)
      } ${height - padBottom} L ${
        padX + (first.distanceM / totalDistanceM) * (width - padX * 2)
      } ${height - padBottom} Z`;
      const colorSegments = plottedPoints
        .slice(1)
        .map((point, index) => {
          const previous = plottedPoints[index];
          const currentSample = renderedSamples[index + 1];
          const previousSample = renderedSamples[index];
          const distanceDeltaM = Math.max(currentSample.distanceM - previousSample.distanceM, 1);
          const gradePct =
            ((currentSample.renderedEle - previousSample.renderedEle) / distanceDeltaM) * 100;

          return `
            <line
              x1="${previous.x.toFixed(2)}"
              y1="${previous.y.toFixed(2)}"
              x2="${point.x.toFixed(2)}"
              y2="${point.y.toFixed(2)}"
              stroke="${getProfileSegmentColor(gradePct)}"
              stroke-width="3.8"
              stroke-linecap="round"
            ></line>
          `;
        })
        .join("");

      return `
        <path d="${fillPath}" fill="rgba(188,128,78,0.11)"></path>
        <path
          d="${path}"
          fill="none"
          stroke="rgba(34,35,39,0.26)"
          stroke-width="6.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        ></path>
        ${colorSegments}
        ${plottedPoints
          .filter((point, index) => index % 6 === 0)
          .map(
            (point) => `
              <circle
                cx="${point.x.toFixed(2)}"
                cy="${point.y.toFixed(2)}"
                r="1.15"
                fill="rgba(255,246,233,0.22)"
              ></circle>
            `
          )
          .join("")}
      `;
    })
    .join("");

  const separators =
    route.profileGroups.length > 1 && route.profileMode !== "overlay"
      ? route.profileGroups
          .slice(0, -1)
          .map((group) => {
            const edge = group.samples[group.samples.length - 1];
            const x = padX + (edge.distanceM / totalDistanceM) * (width - padX * 2);
            return `<line x1="${x.toFixed(2)}" y1="${padTop - 2}" x2="${x.toFixed(
              2
            )}" y2="${height - padBottom + 2}" stroke="rgba(255,255,255,0.055)" stroke-width="1"></line>`;
          })
          .join("")
      : "";

  const zeroLine =
    route.showZeroLine && min < 0 && max > 0
      ? (() => {
          const zeroY = height - padBottom - ((0 - min) / range) * plotHeight;
          return `
            <line
              x1="${padX}"
              y1="${zeroY.toFixed(2)}"
              x2="${width - padX}"
              y2="${zeroY.toFixed(2)}"
              stroke="rgba(31,36,48,0.28)"
              stroke-dasharray="5 5"
            ></line>
            <text
              x="${padX + 4}"
              y="${(zeroY - 6).toFixed(2)}"
              fill="rgba(31,36,48,0.62)"
              font-size="12"
            >0 m</text>
          `;
        })()
      : "";

  const climbMarkup = climbAnnotations
    .map((climb) => {
      const label = `${(climb.distanceM / 1000).toFixed(1).replace(".", ",")} km`;
      const centerX =
        padX +
        (((climb.startDistanceM + climb.endDistanceM) / 2) / totalDistanceM) * (width - padX * 2);
      const pillY = 3 + climb.lane * 12;
      const labelWidth = Math.max(54, label.length * 5.35 + 16);
      const labelX = Math.min(
        Math.max(centerX - labelWidth / 2, padX),
        width - padX - labelWidth
      );
      const dotY = pillY + 15;

      return `
        <rect
          x="${labelX.toFixed(2)}"
          y="${pillY.toFixed(2)}"
          width="${labelWidth.toFixed(2)}"
          height="12"
          rx="6"
          fill="rgba(50,46,42,0.72)"
          stroke="rgba(255,248,235,0.14)"
        ></rect>
        <circle
          cx="${centerX.toFixed(2)}"
          cy="${dotY.toFixed(2)}"
          r="1.7"
          fill="rgba(255,244,226,0.48)"
        ></circle>
        <text
          x="${(labelX + labelWidth / 2).toFixed(2)}"
          y="${(pillY + 8.2).toFixed(2)}"
          fill="rgba(252,246,237,0.94)"
          font-size="8.2"
          font-weight="600"
          text-anchor="middle"
        >${label}</text>
      `;
    })
    .join("");
  const hoverMarkup = `
    <g id="profile-hover-layer" opacity="0">
      <line
        id="profile-hover-line"
        x1="0"
        y1="${padTop.toFixed(2)}"
        x2="0"
        y2="${(height - padBottom).toFixed(2)}"
        stroke="rgba(31,36,48,0.22)"
        stroke-width="1.5"
        stroke-dasharray="5 5"
      ></line>
      ${route.profileGroups
        .map(
          (group, index) => `
            <circle
              id="profile-hover-point-${index}"
              cx="0"
              cy="0"
              r="5"
              fill="${group.accent}"
              stroke="rgba(255,250,240,0.98)"
              stroke-width="2"
              opacity="0"
            ></circle>
          `
        )
        .join("")}
    </g>
  `;

  profileLegendEl.innerHTML = route.showProfileLegend
    ? route.profileGroups
        .map(
          (group) => `
            <span class="profile-legend-item">
              <span class="profile-legend-swatch" style="background:${group.accent}"></span>
              <span>${group.label}</span>
            </span>
          `
        )
        .join("")
    : "";

  profileEl.setAttribute("viewBox", `0 0 ${width} ${height}`);
  profileEl.style.height = `${height}px`;
  profileEl.innerHTML = `
    <defs>
      <linearGradient id="profile-surface" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.11"></stop>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.1"></stop>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${width}" height="${height}" rx="16" fill="url(#profile-surface)"></rect>
    ${gridLines}
    <rect x="0" y="${height - 1}" width="${width}" height="1" fill="rgba(97,85,62,0.14)"></rect>
    ${zeroLine}
    ${separators}
    ${segmentMarkup}
    ${climbMarkup}
    ${hoverMarkup}
  `;

  profileHoverState = {
    width,
    height,
    padX,
    padBottom,
    plotHeight,
    minEleM: min,
    range,
    totalDistanceM,
    groups: route.profileGroups,
    hoverLayerEl: document.getElementById("profile-hover-layer"),
    hoverLineEl: document.getElementById("profile-hover-line"),
    hoverPointEls: route.profileGroups.map((group, index) =>
      document.getElementById(`profile-hover-point-${index}`)
    )
  };
}

function formatDistance(value) {
  return `${value.toFixed(1)} km`;
}

function formatMeters(value) {
  return `${Math.round(value).toLocaleString("en-US")} m`;
}

function getRouteStats(route) {
  return (
    route.stats ?? {
      primaryLabel: "Elevation Gain",
      primaryValue: formatMeters(route.metrics.ascentM),
      distanceLabel: "Distance",
      distanceValue: formatDistance(route.metrics.distanceKm),
      descentLabel: "Descent",
      descentValue: formatMeters(route.metrics.descentM),
      maxEleLabel: "Highest Point",
      maxEleValue: formatMeters(route.metrics.maxEleM)
    }
  );
}

function updateStats(route) {
  hideProfileHover();
  const stats = getRouteStats(route);
  titleEl.textContent = route.title;
  subtitleEl.textContent =
    route.subtitle ??
    (route.id === "overall"
      ? `${route.type} · combined 3D route and combined elevation profile`
      : `${route.type} · ${route.points.length.toLocaleString("en-US")} track points`);
  primaryStatLabelEl.textContent = stats.primaryLabel;
  distanceLabelEl.textContent = stats.distanceLabel;
  descentLabelEl.textContent = stats.descentLabel;
  maxEleLabelEl.textContent = stats.maxEleLabel;
  ascentEl.textContent = stats.primaryValue;
  distanceEl.textContent = stats.distanceValue;
  descentEl.textContent = stats.descentValue;
  maxEleEl.textContent = stats.maxEleValue;
  elevationRangeEl.textContent = route.elevationRangeLabel
    ? `${route.elevationRangeLabel}: ${formatMeters(route.metrics.minEleM)} to ${formatMeters(
        route.metrics.maxEleM
      )}`
    : `${formatMeters(route.metrics.minEleM)} to ${formatMeters(route.metrics.maxEleM)}`;
  renderProfile(route);
}

function getActiveEvent() {
  return loadedEvents.find((event) => event.id === activeEventId) ?? loadedEvents[0];
}

function updateEventCopy(event) {
  eventEyebrowEl.textContent = event.eyebrow;
  eventTitleEl.textContent = event.heroTitle;
  eventIntroEl.textContent = event.intro;
}

function renderEventButtons() {
  eventSwitchEl.innerHTML = "";

  loadedEvents.forEach((event) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `event-button${event.id === activeEventId ? " is-active" : ""}`;
    button.textContent = event.label;
    button.addEventListener("click", () => {
      activeEventId = event.id;
      activeRouteId = event.views[0]?.id ?? "overall";
      applyDefaultCamera(event.views[0]);
      renderEventButtons();
      renderButtons();
      renderActiveRoute();
    });
    eventSwitchEl.appendChild(button);
  });
}

function renderButtons() {
  switchEl.innerHTML = "";
  const event = getActiveEvent();
  if (!event) {
    return;
  }

  event.views.forEach((route) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `route-button${route.id === activeRouteId ? " is-active" : ""}`;
    button.textContent = route.label;
    button.addEventListener("click", () => {
      activeRouteId = route.id;
      applyDefaultCamera(route);
      renderButtons();
      renderActiveRoute();
    });
    switchEl.appendChild(button);
  });
}

function renderActiveRoute() {
  const event = getActiveEvent();
  if (!event) {
    return;
  }

  const route = event.views.find((entry) => entry.id === activeRouteId) ?? event.views[0];
  if (!route) {
    return;
  }

  activeRoute = route;
  updateCanvasInteractionHint(route);
  updateEventCopy(event);
  document.documentElement.style.setProperty("--accent", route.accent);
  updateStats(route);
  drawRoute(route);
}

function setupCanvasInteraction() {
  canvas.addEventListener("pointerdown", (event) => {
    if (activeRoute?.id === "overall" && !cameraState.overallUnlocked) {
      cameraState.overallUnlocked = true;
      updateCanvasInteractionHint(activeRoute);
    }

    cameraState.dragging = true;
    cameraState.pointerId = event.pointerId;
    cameraState.lastX = event.clientX;
    cameraState.lastY = event.clientY;
    canvas.classList.add("is-dragging");
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!cameraState.dragging || event.pointerId !== cameraState.pointerId) {
      return;
    }

    const deltaX = event.clientX - cameraState.lastX;
    const deltaY = event.clientY - cameraState.lastY;
    updateCameraFromDrag(deltaX, deltaY);

    cameraState.lastX = event.clientX;
    cameraState.lastY = event.clientY;

    renderActiveRoute();
  });

  const releasePointer = (event) => {
    if (event.pointerId !== cameraState.pointerId) {
      return;
    }

    cameraState.dragging = false;
    cameraState.pointerId = null;
    canvas.classList.remove("is-dragging");
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  };

  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);

  canvas.addEventListener(
    "wheel",
    (event) => {
      if (activeRoute?.id === "overall" && !cameraState.overallUnlocked) {
        return;
      }

      event.preventDefault();
      const zoomFactor = Math.exp(-event.deltaY * 0.0022);
      cameraState.zoom = clamp(cameraState.zoom * zoomFactor, 0.14, 12);
      renderActiveRoute();
    },
    { passive: false }
  );

  canvas.addEventListener("dblclick", () => {
    applyDefaultCamera(activeRoute);
    renderActiveRoute();
  });
}

function setupProfileInteraction() {
  profileEl.addEventListener("mousemove", updateProfileHover);
  profileEl.addEventListener("mouseleave", hideProfileHover);
}

async function loadEvents() {
  const baseEvents = await Promise.all(
    EVENT_CONFIGS.map(async (event) => {
      const baseRoutes = await Promise.all(
        event.routes.map(async (route) => {
          const response = await fetch(route.file);
          if (!response.ok) {
            throw new Error(`Failed to load file: ${route.file}`);
          }

          return buildSingleRoute(route, parseGpx(await response.text()));
        })
      );

      return buildEventViews(event, baseRoutes);
    })
  );

  const comparisonEvent = buildComparisonEvent(baseEvents);
  loadedEvents = comparisonEvent ? [...baseEvents, comparisonEvent] : baseEvents;
}

async function init() {
  if (window.location.protocol === "file:") {
    setMessage(
      "Opening the page directly via file:// often blocks GPX loading. Start a small web server in this folder instead, for example `python3 -m http.server 8000`, then open http://localhost:8000."
    );
  }

  try {
    await loadEvents();
    setupCanvasInteraction();
    setupProfileInteraction();
    applyDefaultCamera(getActiveEvent().views[0]);
    renderEventButtons();
    renderButtons();
    renderActiveRoute();
  } catch (error) {
    console.error(error);
    setMessage(
      "The GPX files could not be loaded. Open the page through a local web server in this folder."
    );
  }
}

window.addEventListener("resize", () => {
  if (loadedEvents.length > 0) {
    renderActiveRoute();
  }
});

init();
